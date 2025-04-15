from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    destination = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('Message', backref='conversation', lazy=True)
    preferences = db.relationship('TravelPreference', backref='conversation', uselist=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    is_user = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)

class TravelPreference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    destination = db.Column(db.String(100))
    budget = db.Column(db.String(50))
    dates = db.Column(db.String(100))
    num_travelers = db.Column(db.String(20))
    interests = db.Column(db.String(200))
    accommodation_preference = db.Column(db.String(100))
    pace_preference = db.Column(db.String(50))
    transport_preference = db.Column(db.String(100))
    must_see_places = db.Column(db.String(200))