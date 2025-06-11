# Aplicație de Transfer Date Multi-Server

## Cerințe Prealabile

1.  **Python 3.7+**: Asigurați-vă că aveți Python instalat.
2.  **pip**: Installer pentru pachete Python.
3.  **Node.js și npm**: Necesare pentru JSON-Server, JSON-GraphQL-Server și Frontend Server.
4.  **Java**: Necesar pentru RDF4J Server.
5.  **Apache Tomcat**: Pentru implementarea RDF4J Server.

## Instalare

1.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **Frontend Server**:
    ```bash
    cd frontend
    npm install
    ```

3.  **JSON-Server**:
    ```bash
    npm install -g json-server@0.17
    ```

4.  **JSON-GraphQL-Server**:
    ```bash
    npm install -g json-graphql-server
    ```

## Secvența de Pornire Servere

1.  **Pornire RDF4J Server**:
    - Rulați `scripts/startup-rdf4j.bat`. Aceasta va porni Apache Tomcat.
    - Deschideți `http://localhost:8080/rdf4j-workbench` în browser.
    - Creați un nou repository:
        - Tip: `In-Memory Store`
        - ID: `grafexamen`
        - Titlu: `Graf Examen`
    - Mergeți la repository-ul `grafexamen`.
    - Mergeți la `Data` -> `Import`.
    - Încărcați `data/baseball-teams.ttl`.

2.  **Pornire JSON-Server**:
    - Creați un fișier `db_rest.json` în directorul root al proiectului cu următorul conținut:
      ```json
      {
        "teams": [],
        "players": []
      }
      ```
    - Creați un fișier `db_graphql.json` în directorul root al proiectului cu același conținut.
    - **Opțiunea 1**: Folosiți scriptul de pornire: `scripts/startup-json-server.bat`
    - **Opțiunea 2**: Rulați manual în directorul root:
      ```bash
      json-server --watch db_rest.json --port 4000
      ```
    - **Notă**: Eliminați `--delay 500` pentru performanță mai bună în timpul transferurilor

3.  **Pornire JSON-GraphQL-Server** ⚠️ **IMPORTANT**:
    - **Opțiunea 1**: Folosiți scriptul de pornire: `scripts/startup-graphql.bat`
    - **Opțiunea 2**: Rulați manual în directorul root:
      ```bash
      json-graphql-server db_graphql.json --port 3000
      ```
    - **Notă**: Butonul "Transfer către GraphQL" va rămâne blocat dacă acest server nu rulează!

4.  **Pornire Backend Server**:
    ```bash
    cd backend
    uvicorn main:app --reload --port 8000
    ```

5.  **Pornire Frontend Server**:
    ```bash
    cd frontend
    npm start
    ```

## Utilizarea Aplicației

1.  Deschideți `http://localhost:5000` în browser (Frontend Server).
2.  **Butonul 1: Interogare Date RDF4J**:
    - Preia datele de la serverul RDF4J și le afișează în tabelul unificat și ca graf JSON-LD.
    - Transferă automat datele către serverul REST pentru utilizare ulterioară.
3.  **Butonul 2: Afișare Date Server REST**:
    - Preia datele de la JSON-Server și le afișează în tabelul unificat.
4.  **Butonul 3: Transfer către GraphQL**:
    - Ia datele de la JSON-Server și le transferă către JSON-GraphQL-Server.
5.  **Butonul 4: (Trimitere formular cu dropdown)**:
    - Vă permite să interogați proprietăți specifice ale echipelor.
6.  **Butonul 5: Interogare Date GraphQL**:
    - Preia datele de la JSON-GraphQL-Server și le afișează în tabelul unificat.

## Depanare

### Probleme cu Butonul "Transfer către GraphQL"

**Problema 1**: Butonul rămâne blocat în starea de încărcare și nu se întâmplă nimic.

**Soluție**: 
1. Asigurați-vă că JSON-GraphQL-Server rulează:
   - Deschideți un terminal în directorul root al proiectului
   - Rulați: `json-graphql-server db_graphql.json --port 3000`
   - Sau folosiți scriptul de pornire: `scripts/startup-graphql.bat`

2. Verificați consola browserului (F12) pentru mesaje de eroare

3. Verificați starea serverului folosind butonul "🔄 Verificare Stare Server"

**Problema 2**: Eroarea "504: Timeout while fetching data".

**Soluție**:
1. Reporniți JSON Server fără delay:
   - Opriți serverul JSON curent
   - Rulați: `json-server --watch db_rest.json --port 4000` (fără --delay 500)
   - Sau folosiți scriptul de pornire: `scripts/startup-json-server.bat`

2. Reporniți serverul backend:
   - `cd backend`
   - `uvicorn main:app --reload --port 8000`

3. Parametrul delay (`--delay 500`) poate cauza timeout-uri în timpul operațiunilor în bloc

### Server Nu Răspunde

- Verificați că toate serverele necesare rulează pe porturile lor corecte
- Folosiți indicatorii de stare server de pe frontend pentru a verifica conectivitatea
- Asigurați-vă că nicio altă aplicație nu folosește porturile necesare (3000, 4000, 8000, 8080)

## Îmbunătățiri în această Versiune

- **Frontend Server**: Acum folosește un server Express.js în loc de servire fișiere statice
- **Gestionare Îmbunătățită Erori**: Mesaje de eroare mai bune și stări de încărcare cu timeout-uri
- **Suport Execuție Multiplă**: Toate funcționalitățile funcționează acum în mod fiabil de mai multe ori
- **Indicatori de Încărcare**: Feedback vizual în timpul operațiunilor cu date
- **Validare Date**: Verifică datele goale și oferă mesaje corespunzătoare
- **Suport CORS**: Configurație adecvată pentru partajarea resurselor între origini
- **Gestionare Timeout**: Previne blocarea indefinită când serverele nu sunt disponibile

## Referință Configurare Porturi

- **RDF4J Server**: `8080`
- **JSON-Server REST**: `4000`
- **JSON-GraphQL-Server**: `3000` ⚠️ **Trebuie să ruleze pentru transferul GraphQL**
- **Backend (FastAPI)**: `8000`
- **Frontend Server**: `5000`

## Mod Dezvoltare

Pentru dezvoltare cu repornire automată:
```bash
cd frontend
npm run dev
``` 