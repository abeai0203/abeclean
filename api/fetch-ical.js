export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const response = await fetch(url);
        const data = await response.text();

        // Vercel handles headers automatically, but we can set them for clarity
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Access-Control-Allow-Origin', '*');

        return res.status(200).send(data);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch iCal: ' + error.message });
    }
}
