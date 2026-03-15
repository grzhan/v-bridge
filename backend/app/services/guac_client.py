from __future__ import annotations

import base64
import hashlib
import hmac
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import get_settings


@dataclass
class GuacAuth:
    token: str
    data_source: str


class GuacClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def enabled(self) -> bool:
        return self.settings.guac_enabled

    def _mock_connection_id(self, resource_id: int) -> str:
        return f'mock-conn-{resource_id}'

    def _mock_username(self, user_id: int) -> str:
        return f'user-{user_id}'

    def build_user_password(self, user_id: int, username: str) -> str:
        seed = f'guac:{user_id}:{username}'
        digest = hmac.new(self.settings.secret_key.encode('utf-8'), seed.encode('utf-8'), hashlib.sha256).hexdigest()
        return digest[:24]

    def build_legacy_user_password(self, user_id: int, username: str) -> str:
        return f'tmp_{user_id}_{username}'

    def build_user_password_candidates(self, user_id: int, username: str) -> list[str]:
        candidates = [self.build_user_password(user_id, username), self.build_legacy_user_password(user_id, username)]
        # Remove duplicates while keeping order.
        return list(dict.fromkeys(candidates))

    async def _authenticate(self) -> GuacAuth:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f'{self.settings.guac_base_url}/api/tokens',
                data={'username': self.settings.guac_username, 'password': self.settings.guac_password},
            )
            resp.raise_for_status()
            payload = resp.json()
            return GuacAuth(token=payload['authToken'], data_source=payload.get('dataSource', self.settings.guac_data_source))

    def _is_already_exists_error(self, resp: httpx.Response) -> bool:
        if resp.status_code != 400:
            return False
        text = (resp.text or '').lower()
        return 'already exists' in text or '已存在' in text

    async def ensure_user(self, user_id: int, username: str) -> tuple[str, str]:
        if not self.enabled:
            return self._mock_username(user_id), self._mock_username(user_id)

        auth = await self._authenticate()
        guac_username = f'rg_{user_id}_{username}'
        guac_password = self.build_user_password(user_id, username)
        params = {'token': auth.token}
        user_payload = {
            'username': guac_username,
            'password': guac_password,
            'attributes': {
                'disabled': '',
                'expired': '',
                'access-window-start': '',
                'access-window-end': '',
                'valid-from': '',
                'valid-until': '',
                'timezone': 'UTC',
                'guac-full-name': username,
                'guac-organization': 'remote-gateway',
                'guac-organizational-role': 'user',
            },
        }

        async with httpx.AsyncClient(timeout=10) as client:
            await client.patch(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users/{guac_username}',
                params=params,
                json=[],
            )
            # Upsert-like behavior: create first, ignore if exists.
            create_resp = await client.post(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users',
                params=params,
                json=user_payload,
            )
            if create_resp.status_code in (200, 201, 204, 409):
                return guac_username, guac_username
            if self._is_already_exists_error(create_resp):
                return guac_username, guac_username
            if create_resp.status_code not in (200, 201, 204, 409):
                create_resp.raise_for_status()
        return guac_username, guac_username

    async def ensure_user_with_password(self, guac_username: str, guac_password: str, full_name: str) -> tuple[str, str]:
        if not self.enabled:
            return guac_username, guac_username

        auth = await self._authenticate()
        params = {'token': auth.token}
        user_payload = {
            'username': guac_username,
            'password': guac_password,
            'attributes': {
                'disabled': '',
                'expired': '',
                'access-window-start': '',
                'access-window-end': '',
                'valid-from': '',
                'valid-until': '',
                'timezone': 'UTC',
                'guac-full-name': full_name,
                'guac-organization': 'remote-gateway',
                'guac-organizational-role': 'user',
            },
        }

        async with httpx.AsyncClient(timeout=10) as client:
            create_resp = await client.post(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users',
                params=params,
                json=user_payload,
            )
            if create_resp.status_code in (200, 201, 204, 409):
                return guac_username, guac_username
            if self._is_already_exists_error(create_resp):
                return guac_username, guac_username
            create_resp.raise_for_status()

        return guac_username, guac_username

    async def authenticate_as_user(self, guac_username: str, guac_password: str) -> GuacAuth:
        if not self.enabled:
            return GuacAuth(token='mock-token', data_source=self.settings.guac_data_source)

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f'{self.settings.guac_base_url}/api/tokens',
                data={'username': guac_username, 'password': guac_password},
            )
            resp.raise_for_status()
            payload = resp.json()
            return GuacAuth(token=payload['authToken'], data_source=payload.get('dataSource', self.settings.guac_data_source))

    async def authenticate_as_managed_user(self, user_id: int, username: str, guac_username: str) -> GuacAuth:
        if not self.enabled:
            return GuacAuth(token='mock-token', data_source=self.settings.guac_data_source)

        last_error: Exception | None = None
        for candidate in self.build_user_password_candidates(user_id, username):
            try:
                return await self.authenticate_as_user(guac_username=guac_username, guac_password=candidate)
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code if exc.response else None
                if status in (400, 401, 403):
                    last_error = exc
                    continue
                raise

        if last_error:
            raise last_error
        raise RuntimeError('Failed to authenticate guacamole user')

    async def validate_token(self, auth: GuacAuth) -> bool:
        if not self.enabled:
            return True

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/connections',
                params={'token': auth.token},
            )
            return resp.status_code == 200

    def encode_client_identifier(self, connection_id: str, data_source: str) -> str:
        raw = '\0'.join([connection_id, 'c', data_source]).encode('utf-8')
        # Guacamole uses unpadded base64url encoding for client identifiers.
        return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')

    def build_client_launch_url(self, auth: GuacAuth, guac_connection_id: str) -> str:
        client_id = self.encode_client_identifier(guac_connection_id, auth.data_source or self.settings.guac_data_source)
        token = quote(auth.token, safe='')
        base = self.settings.guac_base_url.rstrip('/')
        return f'{base}/#/client/{client_id}?token={token}'

    async def ensure_connection(
        self,
        resource_id: int,
        name: str,
        protocol: str,
        host: str,
        port: int,
        auth_user: str,
        auth_pass: str,
    ) -> str:
        if not self.enabled:
            return self._mock_connection_id(resource_id)

        auth = await self._authenticate()
        params = {'token': auth.token}
        connection_name = f'rg-{resource_id}-{name}'
        payload: dict[str, Any] = {
            'name': connection_name,
            'protocol': protocol,
            'parameters': {
                'hostname': host,
                'port': str(port),
                'username': auth_user,
                'password': auth_pass,
                'ignore-cert': 'true',
            },
            'attributes': {
                'max-connections': '',
                'max-connections-per-user': '',
                'weight': '',
                'failover-only': '',
                'guacd-port': '',
                'guacd-hostname': '',
                'guacd-encryption': '',
            },
        }

        async with httpx.AsyncClient(timeout=10) as client:
            create_resp = await client.post(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/connections',
                params=params,
                json=payload,
            )
            if create_resp.status_code in (200, 201):
                data = create_resp.json()
                return str(data.get('identifier', data.get('id')))
            if create_resp.status_code == 409 or self._is_already_exists_error(create_resp):
                listing = await client.get(
                    f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/connections',
                    params=params,
                )
                listing.raise_for_status()
                records = listing.json()
                for key, value in records.items():
                    if value.get('name') == connection_name:
                        return str(key)
            create_resp.raise_for_status()

        raise RuntimeError('Failed to create guacamole connection')

    async def grant_user_connection(self, guac_username: str, guac_connection_id: str) -> None:
        if not self.enabled:
            return

        auth = await self._authenticate()
        params = {'token': auth.token}
        patch_payload = [
            {
                'op': 'add',
                'path': f'/connectionPermissions/{guac_connection_id}',
                'value': 'READ',
            }
        ]

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.patch(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users/{guac_username}/permissions',
                params=params,
                json=patch_payload,
            )
            if resp.status_code not in (200, 204):
                resp.raise_for_status()

    async def revoke_user_connection(self, guac_username: str, guac_connection_id: str) -> None:
        if not self.enabled:
            return

        auth = await self._authenticate()
        params = {'token': auth.token}
        patch_payload = [
            {
                'op': 'remove',
                'path': f'/connectionPermissions/{guac_connection_id}',
            }
        ]

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.patch(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users/{guac_username}/permissions',
                params=params,
                json=patch_payload,
            )
            if resp.status_code not in (200, 204, 404):
                resp.raise_for_status()

    async def delete_user(self, guac_username: str) -> None:
        if not self.enabled:
            return

        auth = await self._authenticate()
        params = {'token': auth.token}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f'{self.settings.guac_base_url}/api/session/data/{auth.data_source}/users/{guac_username}',
                params=params,
            )
            if resp.status_code not in (200, 204, 404):
                resp.raise_for_status()

    def build_launch_url(self) -> str:
        if self.enabled:
            return f'{self.settings.guac_base_url}/#/'
        return 'http://localhost:8081/#/'
