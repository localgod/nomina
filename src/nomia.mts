import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { AuthService } from './AuthService.mjs';  // Your authentication logic
import vision from '@google-cloud/vision';


import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DriveService {
    private static visionClient = new vision.ImageAnnotatorClient();

    public static async listFiles(): Promise<void> {
        try {
            const authClient: OAuth2Client = await AuthService.authorize();
            const drive = google.drive({ version: 'v3', auth: authClient });

            // Fetch all image files
            //const res = await drive.files.list({
            //    pageSize: 5,
            //    fields: 'files(id, name, mimeType)',
            //    q: "mimeType contains 'image/'"  // Filter for images
            //});

            // fetch selected image files
            const res = await drive.files.list({
                pageSize: 5,
                fields: 'files(id, name, mimeType)',

                q: "mimeType contains 'image/jpeg'"  // Filter for images
            });

            const files = res.data.files;
            if (!files || files.length === 0) {
                console.log('No image files found.');
                return;
            }

            console.log('Found images:');
            for (const file of files) {
                console.log(`${file.name} (${file.id})`);
                await this.processImage(file.id, file.name, drive);
            }
        } catch (error) {
            console.error('Error listing files:', error);
        }
    }

    private static async convertHeicToPng(inputPath: string, outputPath: string) {
        try {
            await sharp(inputPath)
                .toFormat('png')
                .toFile(outputPath);
            console.log(`Converted ${inputPath} to ${outputPath}`);
        } catch (error) {
            console.error('Error converting HEIC to PNG:', error);
        }
    }

    private static async processImage(fileId: string, fileName: string, drive: drive_v3.Drive): Promise<void> {
        const filePath = path.join(__dirname, 'downloads', fileName);
        console.log(filePath)

        // Ensure the downloads directory exists
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        // Download the image
        const dest = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
            drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' },
                (err, res) => {
                    if (err) return reject(err);
                    res?.data.pipe(dest)
                        .on('finish', () => resolve())
                        .on('error', reject);
                }
            );
        });

        console.log(`Downloaded ${fileName}`);
        //const analysePath = path.join(__dirname, 'output.png');
        //this.convertHeicToPng(filePath, analysePath);

        // Analyze using Google Vision
        //await this.analyzeImage(filePath);
    }

    private static async analyzeImage(filePath: string): Promise<void> {
        try {
            const [result] = await this.visionClient.labelDetection(filePath);
            const labels = result.labelAnnotations;

            console.log(`Analysis for ${filePath}:`);
            labels?.forEach(label => console.log(`- ${label.description} (Score: ${label.score})`));
        } catch (error) {
            console.error('Error analyzing image:', error);
        }
    }
}

await DriveService.listFiles()
process.exit(0)
