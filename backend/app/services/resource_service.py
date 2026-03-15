from __future__ import annotations

import logging
import socket

from sqlalchemy.orm import Session

from app.models.models import ResourcePool
from app.services.guac_client import GuacClient

logger = logging.getLogger(__name__)


def check_tcp(host: str, port: int, timeout: float = 2.0) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex((host, port)) == 0


async def health_check_resource(db: Session, resource: ResourcePool) -> str:
    alive = check_tcp(resource.host, resource.port)
    resource.health_status = 'healthy' if alive else 'unreachable'

    if alive:
        guac = GuacClient()
        if resource.guac_connection_id is None:
            try:
                conn_id = await guac.ensure_connection(
                    resource_id=resource.id,
                    name=resource.name,
                    protocol=resource.protocol,
                    host=resource.host,
                    port=resource.port,
                    auth_user=resource.auth_user,
                    auth_pass=resource.auth_pass,
                )
                resource.guac_connection_id = conn_id
            except Exception:
                # Health check should reflect host reachability even if Guacamole sync fails.
                logger.exception('Failed to ensure Guacamole connection for resource id=%s', resource.id)

    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource.health_status
