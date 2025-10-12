from models import db

def commit_changes():
    """Commit das alterações no banco de dados."""
    try:
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        return False

def add_and_commit(obj):
    """Adiciona um objeto ao banco e faz commit."""
    try:
        db.session.add(obj)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        return False

def delete_and_commit(obj):
    """Deleta um objeto do banco e faz commit."""
    try:
        db.session.delete(obj)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        return False

