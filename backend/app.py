import os
from dotenv import load_dotenv
from groq import Groq
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit
import time
from models import db, Conversation, Message, TravelPreference
import pyttsx3
import threading
import requests
from urllib.parse import quote

# Initialize Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///travel_planner.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
socketio = SocketIO(app)
db.init_app(app)

# Initialize database tables
with app.app_context():
    db.create_all()

class VoiceHandler:
    def __init__(self):
        self.engine = None
        self.speaking_thread = None
        self.voice_enabled = True
        self.initialize_engine()
    
    def initialize_engine(self):
        try:
            self.engine = pyttsx3.init()
            self.engine.setProperty('rate', 150)  # Speed of speech
            self.engine.setProperty('volume', 0.9)  # Volume level
            
            # Get available voices and set a good default
            voices = self.engine.getProperty('voices')
            if voices:
                # Try to find a female voice
                female_voice = next((voice for voice in voices if 'female' in voice.name.lower()), None)
                if female_voice:
                    self.engine.setProperty('voice', female_voice.id)
        except Exception as e:
            print(f"Error initializing voice engine: {str(e)}")
            self.voice_enabled = False
    
    def speak(self, text):
        if not self.voice_enabled or not text.strip():
            return
        
        def speak_text():
            try:
                # Clean up the text for better speech
                cleaned_text = text.replace('\n', ' ').strip()
                if cleaned_text:
                    self.engine.say(cleaned_text)
                    self.engine.runAndWait()
            except Exception as e:
                print(f"Error in speech: {str(e)}")
                self.voice_enabled = False
        
        # Stop any existing speech
        if self.speaking_thread and self.speaking_thread.is_alive():
            try:
                self.engine.stop()
                self.speaking_thread.join(timeout=1)
            except:
                pass
        
        # Start new speech in a thread
        self.speaking_thread = threading.Thread(target=speak_text)
        self.speaking_thread.start()
    
    def toggle_voice(self, enabled):
        self.voice_enabled = enabled
        if enabled and not self.engine:
            self.initialize_engine()

voice_handler = VoiceHandler()

# Load environment variables
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("Missing GROQ_API_KEY in your .env file!")

# Initialize Groq client
client = Groq(api_key = api_key)

# Travel questions
QUESTIONS = [
    "Hey there! Where are you planning to travel?",
    "Cool! What's your budget for this trip in dollars?",
    "When are you traveling, and how many days are you staying? (e.g., May 1-5, 2025)",
    "How many people are traveling with you?",
    "What are you into—culture, food, adventure, relaxation, or something else?",
    "Any preference for accommodation—like hotels, Airbnb, or budget stays?",
    "What kind of pace do you prefer—relaxed, balanced, or packed with activities?",
    "Would you like public transport, rental car, or private taxis during your stay?",
    "Do you have any must-visit places or experiences in mind?"
]

def build_prompt(answers):
    prompt = "Plan a personalized travel itinerary based on the following preferences:\n\n"
    for q, a in zip(QUESTIONS, answers):
        prompt += f"{q} {a}\n"
    
    prompt += """
Please create a detailed travel itinerary with the following sections:

TRAVEL METHOD
Recommended transportation options to and around the destination.

ACCOMMODATION
Suggested places to stay based on preferences and budget.

DAY-BY-DAY ITINERARY
For each day include:
Morning: Activities and recommendations
Afternoon: Plans and attractions
Evening: Activities and dining suggestions

DINING RECOMMENDATIONS
Must-try local restaurants
Popular local dishes
Dining experiences based on preferences

LOCAL EXPERIENCES
Cultural activities
Entertainment options
Special experiences based on interests

Please format the response in clear sections with proper spacing, avoiding bullet points or asterisks. Make it engaging and easy to read.
"""
    return prompt

def create_pdf(itinerary_text, answers):
    # Create filename with destination and date
    destination = answers[0].replace(" ", "_")
    current_date = datetime.now().strftime("%Y%m%d")
    filename = f"itinerary_{destination}_{current_date}.pdf"
    
    # Create PDF in memory instead of on disk
    from io import BytesIO
    buffer = BytesIO()
    
    # Create PDF document
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Add title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1
    )
    story.append(Paragraph(f"Travel Itinerary for {answers[0]}", title_style))
    
    # Add trip details
    details_style = ParagraphStyle(
        'Details',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=12,
        leading=16
    )
    
    # Add section header style
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#1a4c7c')
    )
    
    # Add user preferences
    story.append(Paragraph("Trip Details", section_style))
    for q, a in zip(QUESTIONS, answers):
        story.append(Paragraph(f"{q}", details_style))
        story.append(Paragraph(f"{a}", details_style))
        story.append(Spacer(1, 8))
    
    # Add itinerary with better formatting
    story.append(Paragraph("Detailed Itinerary", section_style))
    story.append(Spacer(1, 12))
    
    # Process and format the itinerary text
    sections = itinerary_text.split('\n\n')
    for section in sections:
        if section.strip():
            if section.isupper():
                story.append(Paragraph(section, section_style))
            else:
                story.append(Paragraph(section, details_style))
                story.append(Spacer(1, 8))
    
    # Build PDF
    doc.build(story)
    
    # Get the PDF content from the buffer
    buffer.seek(0)
    return filename, buffer

def validate_destination(text):
    # Simple validation: check if input contains numbers or is too short
    if len(text) < 2:
        return False, "Please enter a valid destination name (at least 2 characters)."
    if any(char.isdigit() for char in text):
        return False, "A destination name shouldn't contain numbers. Please enter a valid city or country name."
    if text.lower() in ['hi', 'hello', 'hey']:
        return False, "Please enter a destination name instead of a greeting. Where would you like to travel?"
    return True, ""

def validate_budget(text):
    # Remove common currency symbols and commas
    text = text.replace('$', '').replace(',', '').strip()
    try:
        amount = float(text)
        if amount <= 0:
            return False, "Please enter a positive amount for your budget."
        return True, ""
    except ValueError:
        return False, "Please enter a valid number for your budget (e.g., 1000 or 1,500)."

def validate_dates(text):
    # Basic date format validation
    if not any(char.isdigit() for char in text):
        return False, "Please include dates in your response (e.g., May 1-5, 2025)."
    return True, ""

def validate_people(text):
    # Validate number of travelers
    text = text.strip()
    try:
        num = int(text)
        if num <= 0:
            return False, "Please enter a valid number of travelers (must be at least 1)."
        return True, ""
    except ValueError:
        return False, "Please enter a number for the group size (e.g., 2)."

VALIDATORS = {
    0: validate_destination,
    1: validate_budget,
    2: validate_dates,
    3: validate_people
}

# Unsplash API configuration
UNSPLASH_ACCESS_KEY = "nTfEy6niAwkF5YUU9CxBR2cpH49QX4UDJvsE3Hj_6z0"

def search_images(query, per_page=6):
    """Search for images using Unsplash API with specific categories"""
    try:
        # Extract destination from the first answer if available
        destination = None
        if hasattr(search_images, 'current_destination'):
            destination = search_images.current_destination

        # Enhance search query based on content type and destination
        enhanced_query = query
        if destination and destination.lower() not in query.lower():
            if any(word in query.lower() for word in ['hotel', 'resort', 'hostel', 'airbnb']):
                enhanced_query = f"{destination} {query} hotel building exterior"
            elif any(word in query.lower() for word in ['food', 'dish', 'cuisine', 'restaurant']):
                enhanced_query = f"{destination} {query} traditional food cuisine"
            else:
                # Assume it's a place/destination
                enhanced_query = f"{destination} {query} landmark destination"

        url = f"https://api.unsplash.com/search/photos"
        params = {
            "query": enhanced_query,
            "per_page": per_page,
            "client_id": UNSPLASH_ACCESS_KEY,
            "orientation": "landscape",
            "content_filter": "high"
        }
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Filter and categorize images
        images = []
        for photo in data['results']:
            category = 'Place'
            if 'hotel' in enhanced_query.lower():
                category = f'Hotels in {destination}' if destination else 'Hotel'
            elif 'food' in enhanced_query.lower():
                category = f'Food from {destination}' if destination else 'Food'
            else:
                category = f'Places in {destination}' if destination else 'Place'
                
            images.append({
                'url': photo['urls']['regular'],
                'thumb': photo['urls']['thumb'],
                'alt': photo['alt_description'] or query,
                'credit': photo['user']['name'],
                'category': category
            })
        return images
    except Exception as e:
        print(f"Error fetching images: {str(e)}")
        return []

@app.route('/toggle-voice', methods=['POST'])
def toggle_voice():
    data = request.json
    enabled = data.get('enabled', True)
    voice_handler.toggle_voice(enabled)
    return jsonify({'status': 'success', 'enabled': enabled})

@app.route('/')
def index():
    # Add initial welcome message to be read
    welcome_message = "Welcome to Travel Planner AI! I'll help you create a personalized travel itinerary. Let's start planning your perfect trip!"
    voice_handler.speak(welcome_message)
    return render_template('index.html', questions=QUESTIONS)

@app.route('/generate', methods=['POST'])
def generate():
    answers = request.json.get('answers', [])
    prompt = build_prompt(answers)
    
    try:
        # Send and speak initial message
        initial_msg = "I'm creating your personalized travel itinerary. This might take a minute...\n\n"
        socketio.emit('response_chunk', {'chunk': initial_msg})
        voice_handler.speak(initial_msg)
        
        time.sleep(1)
        
        completion = client.chat.completions.create(
            model="gemma2-9b-it",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800,
            stream=True,
            stop=None,
            timeout=60
        )

        full_response = ""
        current_sentence = ""
        buffer = ""
        last_update = time.time()
        
        for chunk in completion:
            current_time = time.time()
            content = chunk.choices[0].delta.content or ""
            full_response += content
            buffer += content
            
            # Process complete sentences for speech
            if any(buffer.rstrip().endswith(end) for end in ['.', '!', '?', '\n\n']):
                if buffer.strip():
                    voice_handler.speak(buffer.strip())
                buffer = ""
            
            # Update UI more frequently than speech
            if content or (current_time - last_update) >= 2:
                socketio.emit('response_chunk', {'chunk': content})
                last_update = current_time
                
                if not content and (current_time - last_update) >= 2:
                    socketio.emit('response_chunk', {'chunk': "..."})

        # Speak any remaining text
        if buffer.strip():
            voice_handler.speak(buffer.strip())

        # Store conversation and generate PDF
        messages = [{'content': full_response, 'is_user': False}]
        conversation = store_conversation(answers, messages)
        pdf_file, pdf_buffer = create_pdf(full_response, answers)
        
        return jsonify({
            'status': 'success',
            'pdf_file': pdf_file,
            'conversation_id': conversation.id
        })

    except Exception as e:
        error_message = f"Sorry, there was an error generating your itinerary: {str(e)}"
        socketio.emit('response_chunk', {'chunk': error_message})
        voice_handler.speak(error_message)
        return jsonify({'status': 'error', 'message': error_message})

@app.route('/download/<filename>')
def download(filename):
    try:
        # Generate the PDF on-demand
        destination = filename.split('_')[1].replace('_', ' ')  # Extract destination from filename
        
        # Find the conversation with this destination
        conversation = Conversation.query.filter_by(destination=destination).order_by(Conversation.created_at.desc()).first()
        
        if not conversation:
            return jsonify({'error': 'Itinerary not found'}), 404
            
        # Get the itinerary message
        itinerary_message = next((msg for msg in conversation.messages if not msg.is_user), None)
        if not itinerary_message:
            return jsonify({'error': 'Itinerary content not found'}), 404
            
        # Get the travel preferences
        preferences = TravelPreference.query.filter_by(conversation_id=conversation.id).first()
        if not preferences:
            return jsonify({'error': 'Travel preferences not found'}), 404
            
        # Convert preferences to a list of answers that matches the order expected by create_pdf
        answers = [
            preferences.destination,
            preferences.budget,
            preferences.dates,
            preferences.num_travelers,
            preferences.interests,
            preferences.accommodation_preference,
            preferences.pace_preference,
            preferences.transport_preference,
            preferences.must_see_places
        ]
        
        # Generate the PDF in memory
        _, pdf_buffer = create_pdf(itinerary_message.content, answers)
        
        # Return the PDF directly from memory
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/validate', methods=['POST'])
def validate_input():
    data = request.json
    question_index = data.get('questionIndex', 0)
    answer = data.get('answer', '')
    
    if question_index in VALIDATORS:
        is_valid, message = VALIDATORS[question_index](answer)
        return jsonify({
            'valid': is_valid,
            'message': message
        })
    
    # For questions without specific validation
    return jsonify({
        'valid': True,
        'message': ''
    })

@app.route('/search-images', methods=['POST'])
def search_images_endpoint():
    data = request.json
    query = data.get('query', '')
    destination = data.get('destination', '')
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    # Store the destination for use in image searches
    search_images.current_destination = destination
    
    images = search_images(query)
    return jsonify({'images': images})

@app.route('/conversations')
def get_conversations():
    conversations = Conversation.query.order_by(Conversation.created_at.desc()).all()
    return jsonify([{
        'id': conv.id,
        'destination': conv.destination,
        'created_at': conv.created_at.isoformat(),
        'preview': conv.messages[0].content if conv.messages else ''
    } for conv in conversations])

@app.route('/conversation/<int:conv_id>')
def get_conversation(conv_id):
    conversation = Conversation.query.get_or_404(conv_id)
    messages = [{
        'content': msg.content,
        'is_user': msg.is_user,
        'created_at': msg.created_at.isoformat()
    } for msg in conversation.messages]
    
    preferences = {
        'destination': conversation.preferences.destination,
        'budget': conversation.preferences.budget,
        'dates': conversation.preferences.dates,
        'num_travelers': conversation.preferences.num_travelers,
        'interests': conversation.preferences.interests,
        'accommodation_preference': conversation.preferences.accommodation_preference,
        'pace_preference': conversation.preferences.pace_preference,
        'transport_preference': conversation.preferences.transport_preference,
        'must_see_places': conversation.preferences.must_see_places
    } if conversation.preferences else {}
    
    return jsonify({
        'id': conversation.id,
        'destination': conversation.destination,
        'created_at': conversation.created_at.isoformat(),
        'messages': messages,
        'preferences': preferences
    })

def store_conversation(answers, messages):
    conversation = Conversation(destination=answers[0])
    db.session.add(conversation)
    
    # Store preferences
    preferences = TravelPreference(
        conversation=conversation,
        destination=answers[0],
        budget=answers[1],
        dates=answers[2],
        num_travelers=answers[3],
        interests=answers[4],
        accommodation_preference=answers[5],
        pace_preference=answers[6],
        transport_preference=answers[7],
        must_see_places=answers[8]
    )
    db.session.add(preferences)
    
    # Store messages
    for msg in messages:
        message = Message(
            content=msg['content'],
            is_user=msg['is_user'],
            conversation=conversation
        )
        db.session.add(message)
    
    db.session.commit()
    return conversation

if __name__ == '__main__':
    socketio.run(app, debug=True)
