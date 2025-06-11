# Configurare OpenAI API

Pentru a folosi funcționalitatea de ranking AI, trebuie să configurezi API key-ul OpenAI:

## Pașii de configurare:

1. **Obține un API key OpenAI:**
   - Mergi pe https://platform.openai.com/api-keys
   - Creează un nou API key
   - Copiază API key-ul (începe cu `sk-`)

2. **Configurează API key-ul prin una din metodele de mai jos:**

### Metoda 1: Fișier .env (RECOMANDAT)

Creează un fișier numit `.env` în directorul `backend` cu conținutul:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**⚠️ IMPORTANT:** Înlocuiește `sk-your-actual-api-key-here` cu API key-ul tău real!

### Metoda 2: Variabile de mediu

**Pe Windows (Command Prompt):**
```cmd
set OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Pe Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-your-actual-api-key-here"
```

**Pe Linux/Mac:**
```bash
export OPENAI_API_KEY=sk-your-actual-api-key-here
```

3. **Instalează dependențele:**
   ```bash
   cd backend
   pip install python-dotenv openai
   ```

4. **Pornește serverul backend:**
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

## Troubleshooting

### Eroarea "Incorrect API key provided"
- **Cauza:** API key-ul nu este configurat corect
- **Soluția:** 
  1. Verifică că API key-ul începe cu `sk-`
  2. Verifică că nu ai spații în plus
  3. Verifică că fișierul `.env` este în directorul `backend`
  4. Restartează serverul backend după configurare

### Eroarea "API key găsit: Nu"
- **Cauza:** Fișierul `.env` nu este găsit sau nu are formatul corect
- **Soluția:**
  1. Asigură-te că fișierul se numește exact `.env` (cu punct la început)
  2. Verifică că este în directorul `backend`
  3. Verifică că linia este: `OPENAI_API_KEY=sk-your-key` (fără spații în jurul `=`)

### Cum să verific dacă API key-ul este configurat:
1. Pornește serverul backend
2. Accesează butonul ranking - vei vedea informații de debug în consolă

## Test

După configurare, poți testa funcționalitatea:
- Frontend: http://localhost:5000
- Click pe butonul "🏆 Generate AI Player Ranking 2024"
- Verifică consola backend-ului pentru mesajele de debug

## Note importante:

- **NU** comite fișierul `.env` în repository (este adăugat în .gitignore)
- API key-ul trebuie să înceapă cu `sk-`
- Funcționalitatea va returna informații de debug dacă API key-ul nu este configurat
- Costul per request depinde de numărul de jucători analizați
- Restartează serverul backend după orice modificare la `.env`

## Exemplu fișier .env valid:
```
OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
``` 