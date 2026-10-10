"""Render supplies PORT; worker counts can be adjusted in its dashboard."""
import os

bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
workers = int(os.getenv('WEB_CONCURRENCY', '2'))
worker_class = 'gthread'
threads = int(os.getenv('GUNICORN_THREADS', '4'))
timeout = 120
accesslog = '-'
errorlog = '-'
capture_output = True
