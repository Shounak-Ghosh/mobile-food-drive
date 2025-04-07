# mobile-food-drive
Mobile Food Drive project for our Spring '25 SWE Design project.

For first time usage, the Python virtual environment needs to be created.

Do this using the following:

```
cd backend
python -m venv venv
Mac:
Create new virtual environment: python3 -m venv venv

Activate your virtual environment: source venv/bin/activate

Install requirements: pip install -r requirements.txt

Windows:

Create the virtual environment (on new devices): python -m venv venv

Activate the virtual environment: .\venv\Scripts\Activate

Install requirements (Important! Install directly into the venv with this): .\venv\Scripts\python.exe -m pip install -r requirements.txt

To end virtual environment: deactivate
cd ..
```

Use `npm run dev` to start backend and frontend concurrently.

Current Bugs:
- Double check landing page routing w/back button
- Password visibility appearing twice?
- Password visibility autofill does not adopt background color