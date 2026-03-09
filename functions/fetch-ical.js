export async function onRequest(context) {
    const { searchParams } = new URL(context.request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const response = await fetch(url);
        const data = await response.text();

        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch iCal: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
