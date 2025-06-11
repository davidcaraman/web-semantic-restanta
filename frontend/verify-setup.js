const http = require('http');

const testServer = () => {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`✅ Frontend server is running on http://localhost:5000`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
        
        if (res.statusCode === 200) {
            console.log('✅ Server is responding correctly!');
        } else {
            console.log('⚠️  Server responded with unexpected status code');
        }
    });

    req.on('error', (err) => {
        console.log('❌ Error connecting to frontend server:');
        console.log(err.message);
        console.log('Make sure to run "npm start" first');
    });

    req.end();
};

setTimeout(testServer, 2000); 