import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// If modifying these scopes, delete token.json.
const SCOPES: string[] = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const TOKEN_PATH: string = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH: string = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the saved file.
 */
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
        const content = await fs.readFile(TOKEN_PATH, 'utf-8');
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials) as OAuth2Client;
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 */
async function saveCredentials(client: OAuth2Client): Promise<void> {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    }, null, 2);
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Requests manual authentication for CLI-based usage.
 */
async function authorize(): Promise<OAuth2Client> {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }

    const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;

    client = new google.auth.OAuth2(
        key.client_id,
        key.client_secret,
        'urn:ietf:wg:oauth:2.0:oob'
    );

    const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log(`Authorize this app by visiting this URL:
${authUrl}`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const code = await new Promise<string>((resolve) => {
        rl.question('Enter the authorization code from the page: ', (input) => {
            rl.close();
            resolve(input);
        });
    });

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await saveCredentials(client);

    return client;
}

/**
 * Lists the names and IDs of up to 10 files.
 */
async function listFiles(authClient: OAuth2Client): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const res = await drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
    });
    const files = res.data.files;

    if (!files || files.length === 0) {
        console.log('No files found.');
        return;
    }

    console.log('Files:');
    files.forEach((file) => {
        console.log(`${file.name} (${file.id})`);
    });
}

// Main execution
authorize()
    .then(listFiles)
    .catch(console.error);
