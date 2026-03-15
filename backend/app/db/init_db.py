from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.models import Product, User, UserRole, UserStatus, WalletAccount


def init_db(db: Session) -> None:
    admin = db.query(User).filter(User.username == 'admin').first()
    if not admin:
        admin = User(
            username='admin',
            password_hash=get_password_hash('admin123'),
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        db.add(admin)
        db.flush()
        db.add(WalletAccount(user_id=admin.id, balance=0))

    defaults = [
        ('Windows 2h', 120, 10),
        ('Windows 6h', 360, 25),
        ('Windows 24h', 1440, 80),
    ]
    for name, mins, price in defaults:
        exists = db.query(Product).filter(Product.name == name).first()
        if not exists:
            db.add(Product(name=name, duration_minutes=mins, price=price, enabled=True, group_tag='windows'))

    db.commit()
