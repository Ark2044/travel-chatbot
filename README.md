# Travel Planner AI Chatbot

An interactive Flask-based web application that creates personalized travel itineraries based on user preferences using AI.

![Travel Planner AI](https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80)

## Features

- **Interactive Interface**: Guided conversation to collect travel preferences
- **Voice Capabilities**: Voice input and text-to-speech output
- **AI-Powered Itineraries**: Generates personalized travel plans using Groq AI
- **Destination Visuals**: Integrates with Unsplash API to show relevant travel images
- **PDF Generation**: Creates downloadable PDF itineraries
- **Conversation History**: Stores and retrieves previous travel plans

## Technologies Used

- **Backend**: Flask, Flask-SocketIO
- **Database**: SQLite with SQLAlchemy ORM
- **AI Integration**: Groq API (using gemma2-9b-it model)
- **Voice Features**: pyttsx3 (text-to-speech), SpeechRecognition
- **PDF Generation**: ReportLab
- **Image Search**: Unsplash API
- **Frontend**: HTML, CSS, JavaScript (details in templates/index.html and static/js/main.js)

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/travel-chatbot.git
   cd travel-chatbot
   ```

2. Create a virtual environment and activate it:

   ```
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a `.env` file in the project root with the following:

   ```
   GROQ_API_KEY=your_groq_api_key
   ```

5. Initialize the database:
   ```
   python app.py
   ```

## Usage

1. Start the application:

   ```
   python app.py
   ```

2. Open your web browser and navigate to `http://localhost:5000`

3. Follow the guided conversation to create your travel itinerary:

   - Enter your destination
   - Specify your budget
   - Provide your travel dates
   - Answer additional preference questions

4. Review your personalized itinerary and download the PDF

5. Access your travel history at any time through the conversations panel

## Project Structure

- `app.py`: Main application file with routes and API integration
- `models.py`: Database models for conversations and preferences
- `templates/index.html`: Frontend HTML template
- `static/js/main.js`: Frontend JavaScript functionality
- `instance/travel_planner.db`: SQLite database file
- `requirements.txt`: Python dependencies

## Voice Features

The application includes voice capabilities:

- **Text-to-Speech**: Reads responses aloud
- **Speech Recognition**: Allows voice input for travel preferences

## API Integrations

- **Groq AI**: Generates personalized travel itineraries
- **Unsplash**: Provides destination and travel-related images

## Contributors

- Your Name

## License

MIT License

## Acknowledgments

- This project uses the Groq AI API for natural language processing
- Images provided by Unsplash
- Built with Flask and other open-source libraries
