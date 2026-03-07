import 'dotenv/config';
import Groq from 'groq-sdk';
const client = new Groq({ apiKey: process.env.GROQ_API_KEY_1 });

try {
    const models = await client.models.list();
    console.log('=== AVAILABLE GROQ MODELS ===');
    for (const model of models.data) {
        if (model.id.includes('embed') || model.id.includes('nomic') || model.id.includes('Embed')) {
            console.log('EMBEDDING:', model.id, model.owned_by);
        }
    }
    console.log('\n=== ALL MODELS ===');
    for (const model of models.data.sort((a,b) => a.id.localeCompare(b.id))) {
        console.log(model.id, '|', model.owned_by);
    }
} catch (e) {
    console.log('Error:', e.message);
}
