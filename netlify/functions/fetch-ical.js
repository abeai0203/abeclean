exports.handler = async (event, context) => {
    const url = event.queryStringParameters.url;

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing URL parameter' }),
        };
    }

    try {
        // In Node 20+ (Netlify default), fetch is global
        const response = await fetch(url);
        const data = await response.text();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/calendar',
                'Access-Control-Allow-Origin': '*',
            },
            body: data,
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch iCal: ' + error.message }),
        };
    }
};
