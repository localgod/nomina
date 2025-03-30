import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class AuthService {
    private static SCOPES: string[] = [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ];
    private static TOKEN_PATH: string = path.join(process.cwd(), 'token.json');
    private static CREDENTIALS_PATH: string = path.join(process.cwd(), 'credentials.json');

    /**
     * Reads previously authorized credentials from the saved file.
     */
    private static async loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
        try {
            const content = await fs.readFile(this.TOKEN_PATH, 'utf-8');
            const credentials = JSON.parse(content);
            return google.auth.fromJSON(credentials) as OAuth2Client;
        } catch (err) {
            console.log('No saved credentials found: ' + err);
            return null;
        }
    }

    /**
     * Saves credentials to a file.
     */
    private static async saveCredentials(client: OAuth2Client): Promise<void> {
        const content = await fs.readFile(this.CREDENTIALS_PATH, 'utf-8');
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        }, null, 2);
        await fs.writeFile(this.TOKEN_PATH, payload);
    }

    /**
     * Requests manual authentication for CLI-based usage.
     */
    public static async authorize(): Promise<OAuth2Client> {
        let client = await this.loadSavedCredentialsIfExist();
        if (client) {
            return client;
        }

        const content = await fs.readFile(this.CREDENTIALS_PATH, 'utf-8');
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;

        client = new google.auth.OAuth2(
            key.client_id,
            key.client_secret,
            'urn:ietf:wg:oauth:2.0:oob'
        );

        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
        });

        console.log(`Authorize this app by visiting this URL:\n${authUrl}`);

        const code = await this.promptUser('Enter the authorization code from the page: ');
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        await this.saveCredentials(client);

        return client;
    }

    /**
     * Prompts the user for input.
     */
    private static promptUser(query: string): Promise<string> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(query, (input) => {
                rl.close();
                resolve(input);
            });
        });
    }
}
