import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './AuthService.mjs';

export class DriveService {
    public static async listFiles(): Promise<void> {
        try {
            const authClient: OAuth2Client = await AuthService.authorize();
            const drive = google.drive({ version: 'v3', auth: authClient });

            const res = await drive.files.list({
                pageSize: 10,
                fields: 'nextPageToken, files(id, name, size)',
            });

            const files = res.data.files;

            if (!files || files.length === 0) {
                console.log('No files found.');
                return;
            }

            console.log('Files:');
            files.forEach((file) => {
                const readableSize = file.size ? DriveService.formatFileSize(Number(file.size)) : 'Unknown size';
                console.log(`${file.name} (${file.id}) - ${readableSize}`);
            });
        } catch (error) {
            console.error('Error listing files:', error);
        }
    }

    /**
     * Converts bytes to a human-readable format (e.g., KB, MB, GB).
     */
    private static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
}

DriveService.listFiles()

