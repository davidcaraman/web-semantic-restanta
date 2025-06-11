document.addEventListener('DOMContentLoaded', () => {
    const queryRdf4jBtn = document.getElementById('query-rdf4j');
    const displayRestBtn = document.getElementById('display-rest');
    const transferGraphqlBtn = document.getElementById('transfer-graphql');
    const queryGraphqlBtn = document.getElementById('query-graphql');
    const generateRankingBtn = document.getElementById('generate-ranking');
    const pingServersBtn = document.getElementById('ping-servers');
    const queryForm = document.getElementById('query-form');
    const dataTableBody = document.querySelector('#data-table tbody');
    const jsonLdDisplay = document.getElementById('json-ld-display');
    const keySelect = document.getElementById('key-select');

    const API_URL = 'http://localhost:8000';
    let rdf4jData = null;

    const servers = [
        {
            name: 'rdf4j',
            url: 'http://localhost:8080/rdf4j-workbench',
            displayName: 'RDF4J Server (8080)',
            statusElementId: 'rdf4j-status',
            responseElementId: 'rdf4j-response'
        },
        {
            name: 'rest',
            url: 'http://localhost:4000',
            displayName: 'REST Server (4000)',
            statusElementId: 'rest-status',
            responseElementId: 'rest-response'
        },
        {
            name: 'graphql',
            url: 'http://localhost:3000',
            displayName: 'GraphQL Server (3000)',
            statusElementId: 'graphql-status',
            responseElementId: 'graphql-response'
        },
        {
            name: 'backend',
            url: 'http://localhost:8000/docs',
            displayName: 'Backend Server (8000)',
            statusElementId: 'backend-status',
            responseElementId: 'backend-response'
        }
    ];

    async function pingServer(server) {
        const startTime = Date.now();
        const statusElement = document.getElementById(server.statusElementId);
        const responseElement = document.getElementById(server.responseElementId);
        
        statusElement.textContent = '🔄';
        responseElement.textContent = 'Checking...';
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(server.url, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            statusElement.textContent = '✅';
            responseElement.textContent = `~${responseTime}ms`;
            
            return true;
        } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            if (error.name === 'AbortError') {
                statusElement.textContent = '⏰';
                responseElement.textContent = 'Timeout';
            } else {
                statusElement.textContent = '❌';
                responseElement.textContent = 'Offline';
            }
            
            return false;
        }
    }

    async function pingAllServers() {
        setButtonLoading(pingServersBtn, true);
        
        try {
            const pingPromises = servers.map(server => pingServer(server));
            await Promise.all(pingPromises);
            
            console.log('Server health check completed');
        } catch (error) {
            console.error('Error during server health check:', error);
        } finally {
            setButtonLoading(pingServersBtn, false);
        }
    }

    pingServersBtn.addEventListener('click', pingAllServers);

    setTimeout(pingAllServers, 1000);

    function clearDisplays() {
        dataTableBody.innerHTML = '';
        jsonLdDisplay.textContent = '';
    }

    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText;
        }
    }

    function showTableMessage(message) {
        clearDisplays();
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align: center; font-style: italic;">${message}</td>`;
        dataTableBody.appendChild(row);
    }

    queryRdf4jBtn.addEventListener('click', async () => {
        setButtonLoading(queryRdf4jBtn, true);
        clearDisplays();
        showTableMessage('Querying RDF4J data...');

        const sparqlQuery = `
            PREFIX schema: <http://schema.org/>
            PREFIX ex: <http://example.org/>

            SELECT ?teamName ?teamUrl ?teamDescription ?teamFoundingDate ?teamSport ?teamLocation ?teamCoach ?playerName ?playerHeight ?playerWeight ?playerNationality
            WHERE {
                ?team a schema:SportsTeam ;
                      schema:name ?teamName .
                OPTIONAL { ?team schema:url ?teamUrl . }
                OPTIONAL { ?team schema:description ?teamDescription . }
                OPTIONAL { ?team schema:foundingDate ?teamFoundingDate . }
                OPTIONAL { ?team schema:sport ?teamSport . }
                OPTIONAL { ?team schema:location/schema:name ?teamLocation . }
                OPTIONAL { ?team schema:coach/schema:name ?teamCoach . }
                
                ?team schema:member ?player .
                ?player schema:name ?playerName ;
                       schema:nationality ?playerNationality .
                OPTIONAL { ?player schema:height ?playerHeight . }
                OPTIONAL { ?player schema:weight ?playerWeight . }
                FILTER(?playerNationality = "American")
            }
            ORDER BY ?teamName ?playerName
        `;
        try {
            const response = await fetch(`${API_URL}/rdf4j/query?sparql_query=${encodeURIComponent(sparqlQuery)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            rdf4jData = data;
            displayDataInTableFromRdf(data.results.bindings);
            displayJsonLd(data);
            
            try {
                await transferToRest(data.results.bindings);
                console.log('Data successfully transferred to REST server');
            } catch (transferError) {
                console.error('Error transferring to REST server:', transferError);
            }
        } catch (error) {
            console.error('Error querying RDF4J:', error);
            showTableMessage('Failed to query RDF4J. Make sure all servers are running.');
        } finally {
            setButtonLoading(queryRdf4jBtn, false);
        }
    });

    async function transferToRest(bindings) {
        try {
            await fetch(`${API_URL}/rest/clear`, { method: 'POST' });
        } catch (error) {
            console.log('Clear endpoint may not exist, continuing with transfer...');
        }

        const teams = {};
        const players = [];

        let teamIdCounter = 1;
        let playerIdCounter = 1;
        const playerNames = new Set();

        bindings.forEach(item => {
            const teamName = item.teamName.value;
            if (!teams[teamName]) {
                teams[teamName] = {
                    name: teamName,
                    url: item.teamUrl?.value || null,
                    description: item.teamDescription?.value || null,
                    foundingDate: item.teamFoundingDate?.value || null,
                    sport: item.teamSport?.value || null,
                    location: item.teamLocation?.value || null,
                    coach: item.teamCoach?.value || null
                };
            }
        });

        const teamsArray = Object.values(teams);
        
        const teamNameToData = {};
        Object.keys(teams).forEach(teamName => {
            teamNameToData[teamName] = teams[teamName];
        });

        bindings.forEach(item => {
            const playerName = item.playerName.value;
            if (!playerNames.has(playerName)) {
                playerNames.add(playerName);
                players.push({
                    name: playerName,
                    height: item.playerHeight?.value || null,
                    weight: item.playerWeight?.value || null,
                    nationality: item.playerNationality?.value || null,
                    teamName: item.teamName.value
                });
            }
        });

        try {
            const teamsResponse = await fetch(`${API_URL}/rest/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamsArray)
            });
            
            if (!teamsResponse.ok) {
                throw new Error(`Teams transfer failed: ${teamsResponse.status}`);
            }

            const createdTeamsResponse = await fetch(`${API_URL}/rest/data`);
            if (!createdTeamsResponse.ok) {
                throw new Error(`Failed to fetch created teams: ${createdTeamsResponse.status}`);
            }
            const createdData = await createdTeamsResponse.json();
            
            const teamNameToId = {};
            createdData.teams.forEach(team => {
                teamNameToId[team.name] = team.id;
            });

            const playersWithTeamIds = players.map(player => ({
                ...player,
                team_id: teamNameToId[player.teamName]
            })).map(player => {
                const { teamName, ...playerWithoutTeamName } = player;
                return playerWithoutTeamName;
            });

            const playersResponse = await fetch(`${API_URL}/rest/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playersWithTeamIds)
            });
            
            if (!playersResponse.ok) {
                throw new Error(`Players transfer failed: ${playersResponse.status}`);
            }

            console.log("Data transferred to REST server successfully");
        } catch (error) {
            console.error('Error transferring data to REST server:', error);
            throw error;
        }
    }

    displayRestBtn.addEventListener('click', async () => {
        setButtonLoading(displayRestBtn, true);
        clearDisplays();
        showTableMessage('Fetching REST server data...');

        try {
            const response = await fetch(`${API_URL}/rest/data`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.teams || !data.players) {
                showTableMessage('No data found on REST server. Try querying RDF4J data first.');
                return;
            }

            const unifiedData = [];
            data.teams.forEach(team => {
                const teamPlayers = data.players.filter(p => p.team_id === team.id);
                if (teamPlayers.length === 0) {
                    unifiedData.push({
                        teamName: { value: team.name },
                        playerName: { value: 'N/A' },
                        property: { value: 'team_info' },
                        value: { value: 'No players found' }
                    });
                } else {
                    teamPlayers.forEach(player => {
                        Object.entries(player).forEach(([key, value]) => {
                            if (key !== 'id' && key !== 'team_id' && value !== null) {
                                unifiedData.push({
                                    teamName: { value: team.name },
                                    playerName: { value: player.name },
                                    property: { value: key },
                                    value: { value: value }
                                });
                            }
                        });
                    });
                }
            });
            
            if (unifiedData.length === 0) {
                showTableMessage('No data to display from REST server.');
            } else {
                displayDataInTable(unifiedData);
            }
        } catch (error) {
            console.error('Error fetching REST data:', error);
            showTableMessage('Failed to fetch REST data. Make sure the REST server is running.');
        } finally {
            setButtonLoading(displayRestBtn, false);
        }
    });

    transferGraphqlBtn.addEventListener('click', async () => {
        setButtonLoading(transferGraphqlBtn, true);
        
        try {
            const response = await fetch(`${API_URL}/graphql/transfer`, { method: 'POST' });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                if (errorData && errorData.detail) {
                    errorMessage = errorData.detail;
                }
                
                if (response.status === 503) {
                    errorMessage += '\n\nTo start the GraphQL server:\n1. Open a terminal in the project root\n2. Run: json-graphql-server db_graphql.json --port 3000\n\nOr use the startup script: scripts/startup-graphql.bat';
                }
                
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            const successRate = result.total_operations > 0 
                ? Math.round((result.successful_operations / result.total_operations) * 100) 
                : 0;
            
            let message = `Transfer Summary:\n`;
            message += `• Total operations: ${result.total_operations}\n`;
            message += `• Successful: ${result.successful_operations}\n`;
            message += `• Failed: ${result.failed_operations}\n`;
            message += `• Success rate: ${successRate}%\n\n`;
            message += result.message;
            
            if (result.failed_operations > 0) {
                message += `\n\nTip: If there are failures, check:\n1. GraphQL server is running\n2. Data format is correct\n3. No duplicate entries`;
            }
            
            alert(message);
            
        } catch (error) {
            console.error('Error transferring to GraphQL:', error);
            alert(`Transfer to GraphQL failed:\n${error.message}`);
        } finally {
            setButtonLoading(transferGraphqlBtn, false);
        }
    });

    queryGraphqlBtn.addEventListener('click', async () => {
        setButtonLoading(queryGraphqlBtn, true);
        clearDisplays();
        showTableMessage('Querying GraphQL data...');

        const graphqlQuery = `
            {
                allTeams {
                    id
                    name
                    url
                    description
                    foundingDate
                    sport
                    location
                    coach
                }
                allPlayers {
                    id
                    name
                    height
                    weight
                    nationality
                    team_id
                }
            }
        `;

        try {
            const response = await fetch(`${API_URL}/graphql/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: graphqlQuery })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                if (errorData && errorData.detail) {
                    errorMessage = errorData.detail;
                }
                
                if (response.status === 503) {
                    errorMessage += '\n\nTo start the GraphQL server:\n1. Open a terminal in the project root\n2. Run: json-graphql-server db_graphql.json --port 3000\n\nOr use the startup script: scripts/startup-graphql.bat';
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            if (data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
            }
            
            const graphqlData = data.data;
            
            if (!graphqlData.allTeams || !graphqlData.allPlayers) {
                showTableMessage('No data found on GraphQL server. Try transferring data first.');
                return;
            }

            const unifiedData = [];
            graphqlData.allTeams.forEach(team => {
                const teamPlayers = graphqlData.allPlayers.filter(p => p.team_id === team.id);
                if (teamPlayers.length === 0) {
                    unifiedData.push({
                        teamName: { value: team.name },
                        playerName: { value: 'N/A' },
                        property: { value: 'team_info' },
                        value: { value: 'No players found' }
                    });
                } else {
                    teamPlayers.forEach(player => {
                        Object.entries(player).forEach(([key, value]) => {
                            if (key !== 'id' && key !== 'team_id' && value !== null && value !== '') {
                                unifiedData.push({
                                    teamName: { value: team.name },
                                    playerName: { value: player.name },
                                    property: { value: key },
                                    value: { value: value }
                                });
                            }
                        });
                    });
                }
            });
            
            if (unifiedData.length === 0) {
                showTableMessage('No data to display from GraphQL server.');
            } else {
                displayDataInTable(unifiedData);
            }
            
        } catch (error) {
            console.error('Error querying GraphQL:', error);
            showTableMessage('Failed to query GraphQL data. Make sure the GraphQL server is running.');
        } finally {
            setButtonLoading(queryGraphqlBtn, false);
        }
    });

    generateRankingBtn.addEventListener('click', async () => {
        setButtonLoading(generateRankingBtn, true);
        clearDisplays();
        showTableMessage('Generating AI player ranking for 2024...');

        try {
            const response = await fetch(`${API_URL}/rdf4j/ranking`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                showTableMessage(`Error: ${data.error}`);
                return;
            }
            
            displayRankingResults(data);
            
        } catch (error) {
            console.error('Error generating ranking:', error);
            showTableMessage('Failed to generate ranking. Make sure all servers are running and OpenAI API key is configured.');
        } finally {
            setButtonLoading(generateRankingBtn, false);
        }
    });

    function displayDataInTableFromRdf(bindings) {
        clearDisplays();
        
        if (!bindings || bindings.length === 0) {
            showTableMessage('No data found');
            return;
        }

        bindings.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key !== 'teamName' && key !== 'playerName') {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.teamName ? item.teamName.value : 'N/A'}</td>
                        <td>${item.playerName ? item.playerName.value : 'N/A'}</td>
                        <td>${key}</td>
                        <td>${item[key] ? item[key].value : 'N/A'}</td>
                    `;
                    dataTableBody.appendChild(row);
                }
            });
        });
    }

    function displayDataInTable(bindings) {
        clearDisplays();
        
        if (!bindings || bindings.length === 0) {
            showTableMessage('No data found');
            return;
        }

        bindings.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.teamName ? item.teamName.value : 'N/A'}</td>
                <td>${item.playerName ? item.playerName.value : 'N/A'}</td>
                <td>${item.property ? item.property.value : 'N/A'}</td>
                <td>${item.value ? item.value.value : 'N/A'}</td>
            `;
            dataTableBody.appendChild(row);
        });
    }

    function displayJsonLd(data) {
        if (!data) return;
        
        const jsonLdContent = {
            "@context": {
                "@vocab": "http://schema.org/",
                "ex": "http://example.org/"
            },
            "@graph": []
        };

        const teamsMap = new Map();
        const playersMap = new Map();

        data.results.bindings.forEach(binding => {
            const teamName = binding.teamName?.value;
            const playerName = binding.playerName?.value;

            if (teamName && !teamsMap.has(teamName)) {
                const team = {
                    "@type": "SportsTeam",
                    "@id": `ex:${teamName.replace(/\s+/g, '_').toLowerCase()}`,
                    "name": teamName
                };

                if (binding.teamUrl?.value) team.url = binding.teamUrl.value;
                if (binding.teamDescription?.value) team.description = binding.teamDescription.value;
                if (binding.teamFoundingDate?.value) team.foundingDate = binding.teamFoundingDate.value;
                if (binding.teamSport?.value) team.sport = binding.teamSport.value;
                if (binding.teamLocation?.value) team.location = { name: binding.teamLocation.value };
                if (binding.teamCoach?.value) team.coach = { name: binding.teamCoach.value };

                team.member = [];
                teamsMap.set(teamName, team);
            }

            if (playerName && !playersMap.has(playerName)) {
                const player = {
                    "@type": "Person",
                    "@id": `ex:${playerName.replace(/\s+/g, '_').toLowerCase()}`,
                    "name": playerName
                };

                if (binding.playerHeight?.value) player.height = binding.playerHeight.value;
                if (binding.playerWeight?.value) player.weight = binding.playerWeight.value;
                if (binding.playerNationality?.value) player.nationality = binding.playerNationality.value;

                playersMap.set(playerName, player);
            }

            if (teamName && playerName) {
                const team = teamsMap.get(teamName);
                const playerId = `ex:${playerName.replace(/\s+/g, '_').toLowerCase()}`;
                if (!team.member.includes(playerId)) {
                    team.member.push(playerId);
                }
            }
        });

        jsonLdContent["@graph"] = [...teamsMap.values(), ...playersMap.values()];

        jsonLdDisplay.textContent = JSON.stringify(jsonLdContent, null, 2);
    }

    function displayRankingResults(data) {
        clearDisplays();
        
        const rankingDiv = document.createElement('div');
        rankingDiv.style.cssText = 'margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;';
        
        let content = '<h3 style="color: #495057; margin-top: 0;">🏆 AI Generated Player Ranking 2024</h3>';
        
        if (data.error) {
            content += `<div style="color: #dc3545; padding: 10px; background-color: #f8d7da; border-radius: 5px; margin-bottom: 15px;">
                <strong>Error:</strong> ${data.error}<br>
                ${data.suggestion ? `<strong>Suggestion:</strong> ${data.suggestion}` : ''}
            </div>`;
        }
        
        if (data.players_count) {
            content += `<p><strong>Players Analyzed:</strong> ${data.players_count}</p>`;
        }
        
        if (data.openai_ranking) {
            if (data.openai_ranking.error) {
                content += `<div style="color: #dc3545; padding: 10px; background-color: #f8d7da; border-radius: 5px; margin-bottom: 15px;">
                    <strong>OpenAI Error:</strong> ${data.openai_ranking.error}<br>
                    ${data.openai_ranking.suggestion ? `<strong>Suggestion:</strong> ${data.openai_ranking.suggestion}` : ''}
                    ${data.openai_ranking.debug_info ? `<br><strong>Debug:</strong> ${data.openai_ranking.debug_info}` : ''}
                </div>`;
            } else if (data.openai_ranking.openai_response) {
                content += `<div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                    <h4 style="color: #28a745; margin-top: 0;">AI Analysis Results:</h4>
                    <pre style="white-space: pre-wrap; font-family: inherit; background-color: #f8f9fa; padding: 10px; border-radius: 3px; font-size: 14px;">${data.openai_ranking.openai_response}</pre>
                </div>`;
                
                if (data.openai_ranking.model_used) {
                    content += `<small style="color: #6c757d;">Model: ${data.openai_ranking.model_used}`;
                    if (data.openai_ranking.tokens_used) {
                        content += ` | Tokens: ${data.openai_ranking.tokens_used}`;
                    }
                    content += '</small>';
                }
            }
        }
        
        rankingDiv.innerHTML = content;
        document.querySelector('#data-table').parentNode.insertBefore(rankingDiv, document.querySelector('#data-table'));
    }

    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedKey = keySelect.value;
        const button = document.querySelector('#query-form button');
        
        if (!rdf4jData || !rdf4jData.results || !rdf4jData.results.bindings) {
            alert('No RDF4J data available. Please query RDF4J first.');
            return;
        }
        
        setButtonLoading(button, true);
        clearDisplays();
        showTableMessage(`Querying teams by ${selectedKey}...`);
        
        try {
            const sparqlQueryKey = selectedKey === 'name' ? 'teamName' : 
                                   selectedKey === 'foundingDate' ? 'teamFoundingDate' : 
                                   selectedKey === 'sport' ? 'teamSport' : 'teamName';
            
            const filteredBindings = rdf4jData.results.bindings.filter(binding => 
                binding[sparqlQueryKey] && binding[sparqlQueryKey].value
            );
            
            if (filteredBindings.length === 0) {
                showTableMessage(`No teams found with ${selectedKey} data.`);
                return;
            }
            
            const propertyData = [];
            const teamsProcessed = new Set();
            
            filteredBindings.forEach(binding => {
                const teamName = binding.teamName?.value;
                const propertyValue = binding[sparqlQueryKey]?.value;
                
                if (teamName && propertyValue && !teamsProcessed.has(teamName)) {
                    teamsProcessed.add(teamName);
                    propertyData.push({
                        teamName: { value: teamName },
                        playerName: { value: 'Team Property' },
                        property: { value: selectedKey },
                        value: { value: propertyValue }
                    });
                }
            });
            
            if (propertyData.length === 0) {
                showTableMessage(`No unique teams found with ${selectedKey} data.`);
            } else {
                displayDataInTable(propertyData);
            }
            
        } catch (error) {
            console.error('Error querying property:', error);
            showTableMessage('Failed to query property data.');
        } finally {
            setButtonLoading(button, false);
        }
    });
}); 