# MedScan-3D
MedScan 3D Platform is an end-to-end tumor detection system designed to help medical professionals analyze scans faster and with greater consistency. It combines deep learning inference, secure data handling, and interactive 3D visualization to streamline review workflows.

# Clone the project
git clone https://github.com/PriyaDev14/MedScan-3D.git
cd medical-ai-platform

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (in new terminal)
cd frontend
npm install
npm start

# Celery (in new terminal)
cd backend
celery -A core worker -l info

# Docker (optional)
docker-compose up -d
