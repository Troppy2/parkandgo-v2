# Contribution Guide

Use this file as the short checklist before opening a pull request or committing changes.

## Local Setup

### Backend

```bash
# From anywhere in Windows PowerShell, quote paths that contain spaces:
Set-Location -LiteralPath "C:\Users\parkandgo-v2\Backend"

# Windows (PowerShell / CMD)
# Install Python 3.11 first if needed, then create and activate the venv:
py -3.11 -m venv venv
venv\Scripts\activate

# macOS / Linux
cd Backend
python3.11 -m venv venv
source venv/bin/activate

pip install -r requirements/dev.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```

### Full Stack

```bash
docker-compose up
```

## Before Committing

Run the checks that match the area you changed:

```bash
# Backend
cd Backend
pytest

# Frontend
cd Frontend
npm run build
npm run lint
npm run test
```

If your change touches both sides, run both backend and frontend checks before committing.

## AI-Generated Code

If AI was used while working on an issue, do not assume the code is correct just because it looks right.

- Test the changed code and confirm it works as expected.
- Check that the change does not break existing behavior elsewhere in the codebase.
- Run the appropriate backend and/or frontend checks before committing.
- If the change affects shared behavior, verify the related tests or flows too.

## Additional Notes

- Keep commits focused and easy to review.
- Update or add tests when behavior changes.
- Prefer existing project patterns over introducing new ones.
