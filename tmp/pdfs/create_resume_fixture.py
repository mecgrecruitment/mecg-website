from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas


OUTPUT = "/Users/rbhavan/pro/tmp/pdfs/resume-e2e-fixture.pdf"

document = canvas.Canvas(OUTPUT, pagesize=LETTER)
document.setTitle("Resume upload end-to-end fixture")
document.setFont("Helvetica-Bold", 20)
document.drawString(72, 720, "Resume Upload Test")
document.setFont("Helvetica", 11)
document.drawString(72, 690, "Synthetic document - contains no applicant or personal data.")
document.drawString(72, 670, "Purpose: verify upload, PDF validation, attachment, and Board access.")
document.drawString(72, 650, "Fixture ID: MECG-RESUME-E2E-20260902")
document.showPage()
document.save()
