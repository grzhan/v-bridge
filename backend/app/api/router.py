from fastapi import APIRouter

from app.api.routers import admin, auth, me, products

api_router = APIRouter(prefix='/api')
api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(me.router)
api_router.include_router(admin.router)
