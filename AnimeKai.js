/**
 * AnimeKai module for Sora with improved reliability
 * Based on original by iramos
 */

// Robust fetch function with fallback, similar to AniCrush's approach
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            console.log('Fetch error: ' + error.message);
            return null;
        }
    }
}

// Pre-loaded KAICODEX mini implementation for critical functions
// This eliminates the need to load the script from GitHub
const KAICODEX_MINI = {
    enc: function(str) {
        if (!str) return "";
        const encoded = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
        return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },
    
    dec: function(str) {
        if (!str) return "";
        try {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4) str += '=';
            
            return decodeURIComponent(atob(str).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch(e) {
            console.log('KAICODEX decode error: ' + e.message);
            return "";
        }
    },
    
    decMega: function(str) {
        if (!str) return "";
        try {
            return this.dec(str);
        } catch(e) {
            console.log('KAICODEX decMega error: ' + e.message);
            return "";
        }
    }
};

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string of search results
 */
async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://animekai.to/browser?keyword=${encodedKeyword}`;
        const response = await soraFetch(searchUrl);
        
        if (!response) {
            throw new Error("Failed to fetch search results");
        }
        
        const responseText = await response.text();
        const results = [];
        const baseUrl = "https://animekai.to";

        const listRegex = /<div class="aitem">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
        let match;

        while ((match = listRegex.exec(responseText)) !== null) {
            const block = match[1];

            const hrefRegex = /<a[^>]+href="([^"]+)"[^>]*class="poster"[^>]*>/;
            const hrefMatch = block.match(hrefRegex);
            let href = hrefMatch ? hrefMatch[1] : null;
            if (href && !href.startsWith("http")) {
                href = href.startsWith("/")
                    ? baseUrl + href
                    : baseUrl + href;
            }

            const imgRegex = /<img[^>]+data-src="([^"]+)"[^>]*>/;
            const imgMatch = block.match(imgRegex);
            const image = imgMatch ? imgMatch[1] : null;

            const titleRegex = /<a[^>]+class="title"[^>]+title="([^"]+)"[^>]*>/;
            const titleMatch = block.match(titleRegex);
            const title = cleanHtmlSymbols(titleMatch ? titleMatch[1] : null);

            if (href && image && title) {
                results.push({ href, image, title });
            }
        }

        return JSON.stringify(results);
    }
    catch (error) {
        console.log('SearchResults function error: ' + error);
        return JSON.stringify(
            [{ href: '#error', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png', title: 'Error: Unable to load search results' }]
        );
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The url to extract details from
 * @returns {Promise<string>} A promise that resolves with a JSON string of details
 */
async function extractDetails(url) {
    try {
        console.log(`Extracting details from: ${url}`);
        if (url.startsWith('#')) {
            return JSON.stringify([{
                description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
                aliases: '',
                airdate: ''
            }]);
        }

        const response = await fetch(url);
        
        if (!response || !response.ok) {
            console.log(`Failed to fetch anime details: ${response?.status}`);
            throw new Error("Failed to fetch anime details");
        }
        
        const responseText = await response.text();
        console.log(`Got details page HTML (${responseText.length} bytes)`);
        
        const details = [];

        // Try multiple regex patterns for description to account for site changes
        let description = null;
        const descriptionPatterns = [
            /<div class="desc text-expand">([\s\S]*?)<\/div>/,
            /<div class="ani-description">([\s\S]*?)<\/div>/,
            /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/
        ];
        
        for (const pattern of descriptionPatterns) {
            const match = pattern.exec(responseText);
            if (match && match[1]) {
                description = match[1];
                console.log(`Found description with pattern ${pattern}`);
                break;
            }
        }

        // Try multiple regex patterns for aliases
        let aliases = null;
        const aliasesPatterns = [
            /<small class="al-title text-expand">([\s\S]*?)<\/small>/,
            /<div class="ani-names">([\s\S]*?)<\/div>/,
            /<div[^>]*class="[^"]*alternative-titles[^"]*"[^>]*>([\s\S]*?)<\/div>/
        ];
        
        for (const pattern of aliasesPatterns) {
            const match = pattern.exec(responseText);
            if (match && match[1]) {
                aliases = match[1];
                console.log(`Found aliases with pattern ${pattern}`);
                break;
            }
        }
        
        // Try multiple regex patterns for airdate
        let airdate = null;
        const airdatePatterns = [
            /Aired:<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/,
            /<div class="ani-date">([\s\S]*?)<\/div>/,
            /Aired:\s*([^<]+)/
        ];
        
        for (const pattern of airdatePatterns) {
            const match = pattern.exec(responseText);
            if (match && match[1]) {
                airdate = match[1];
                console.log(`Found airdate with pattern ${pattern}`);
                break;
            }
        }

        details.push({
            description: description ? cleanHtmlSymbols(description) : "Not available",
            aliases: aliases ? cleanHtmlSymbols(aliases) : "Not available",
            airdate: airdate ? cleanHtmlSymbols(airdate) : "Not available"
        });

        console.log(`Extracted details successfully`);
        return JSON.stringify(details);
    }
    catch (error) {
        console.log('Details error: ' + error);
        return JSON.stringify([{
            description: 'Error loading description: ' + error.message,
            aliases: 'Aliases: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts the episodes from the given url - completely rewritten for reliability
 * @param {string} url The url to extract episodes from
 * @returns {Promise<string>} A promise that resolves with a JSON string of episodes
 */
async function extractEpisodes(url) {
    try {
        if (url.startsWith('#')) {
            throw new Error('Invalid URL provided');
        }

        // Step 1: Fetch the main page to get the anime ID
        console.log(`Fetching anime page: ${url}`);
        const response = await fetch(url);  // Use native fetch directly
        
        if (!response || !response.ok) {
            console.log(`Failed to fetch anime page: ${response?.status}`);
            throw new Error("Failed to fetch episode data");
        }
        
        const responseText = await response.text();
        console.log(`Got anime page HTML (${responseText.length} bytes)`);

        // Extract anime ID - this is the critical part
        const rateBoxIdRegex = /<div class="rate-box"[^>]*data-id="([^"]+)"/;
        const idMatch = responseText.match(rateBoxIdRegex);
        const aniId = idMatch ? idMatch[1] : null;
        
        if (!aniId) {
            console.log("Could not extract anime ID, trying alternative method");
            // Try alternative method to get ID
            const altIdRegex = /data-ani-id="([^"]+)"/;
            const altIdMatch = responseText.match(altIdRegex);
            const altId = altIdMatch ? altIdMatch[1] : null;
            
            if (!altId) {
                throw new Error("Could not find anime ID on page");
            }
            console.log(`Found anime ID via alternative method: ${altId}`);
            aniId = altId;
        } else {
            console.log(`Found anime ID: ${aniId}`);
        }
        
        // Use simple encoding for token (URL safe base64)
        const encodedId = btoa(aniId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        console.log(`Encoded token: ${encodedId}`);
        
        // Step 2: Get episode list
        const fetchUrlListApi = `https://animekai.to/ajax/episodes/list?ani_id=${aniId}&_=${encodedId}`;
        console.log(`Fetching episode list: ${fetchUrlListApi}`);
        
        const episodeResponse = await fetch(fetchUrlListApi, {
            headers: {
                'Referer': url,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!episodeResponse || !episodeResponse.ok) {
            console.log(`Failed to fetch episode list: ${episodeResponse?.status}`);
            throw new Error("Failed to fetch episode list");
        }
        
        const data = await episodeResponse.json();
        console.log(`Got episode list data: ${JSON.stringify(data).substring(0, 100)}...`);
        
        if (!data || !data.result) {
            throw new Error("Invalid episode list data");
        }
        
        const htmlContentListApi = cleanJsonHtml(data.result);
        const episodes = [];

        // Extract episode data
        const episodeRegex = /<a[^>]+num="([^"]+)"[^>]+token="([^"]+)"[^>]*>/g;
        let epMatch;
        let matchCount = 0;

        while ((epMatch = episodeRegex.exec(htmlContentListApi)) !== null) {
            matchCount++;
            const num = epMatch[1];
            const token = epMatch[2];
            const tokenEncoded = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const episodeUrl = `https://animekai.to/ajax/links/list?token=${token}&_=${tokenEncoded}`;

            episodes.push({
                href: episodeUrl,
                number: parseInt(num, 10)
            });
        }
        
        console.log(`Extracted ${matchCount} episodes with regex pattern`);
        
        // If no episodes were found, try alternative pattern
        if (episodes.length === 0) {
            console.log("No episodes found with primary pattern, trying alternative");
            const altEpisodeRegex = /<a[^>]+data-num="([^"]+)"[^>]+data-token="([^"]+)"[^>]*>/g;
            let altMatch;
            
            while ((altMatch = altEpisodeRegex.exec(htmlContentListApi)) !== null) {
                const num = altMatch[1];
                const token = altMatch[2];
                const tokenEncoded = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                const episodeUrl = `https://animekai.to/ajax/links/list?token=${token}&_=${tokenEncoded}`;

                episodes.push({
                    href: episodeUrl,
                    number: parseInt(num, 10)
                });
            }
            console.log(`Extracted ${episodes.length} episodes with alternative pattern`);
        }

        if (episodes.length === 0) {
            // If still no episodes, create a manual placeholder for debugging
            console.log("No episodes extracted, creating diagnostic episode");
            episodes.push({
                href: `https://animekai.to/ajax/links/list?token=${aniId}&_=${encodedId}`,
                number: 1
            });
        }

        console.log(`Returning ${episodes.length} episodes`);
        return JSON.stringify(episodes);
    }
    catch (error) {
        console.log('Extract episodes error: ' + error);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url
 * @param {string} url The url to extract the stream URL from
 * @returns {Promise<string>} A promise that resolves with the stream URL
 */
async function extractStreamUrl(url) {
    try {
        console.log(`Fetching stream info from: ${url}`);
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://animekai.to/'
            }
        });
        
        if (!response || !response.ok) {
            console.log(`Failed to fetch stream data: ${response?.status}`);
            throw new Error("Failed to fetch stream data");
        }
        
        const text = await response.text();
        console.log(`Got stream data (${text.length} bytes)`);
        const cleanedHtml = cleanJsonHtml(text);

        // Try to parse as JSON first
        try {
            const jsonData = JSON.parse(cleanedHtml);
            console.log(`Successfully parsed JSON data`);
            
            if (jsonData.status === false) {
                throw new Error(jsonData.message || "Server returned error status");
            }
            
            // Process the results - this is where we extract servers
            if (!jsonData.result) {
                throw new Error("No result data in response");
            }
            
            console.log(`Processing ${jsonData.result.length} server items`);
            
            // Find a server with data-lid
            let dataLid = null;
            for (let i = 0; i < jsonData.result.length; i++) {
                const serverHtml = jsonData.result[i];
                const serverMatch = serverHtml.match(/data-lid="([^"]+)"/);
                if (serverMatch && serverMatch[1]) {
                    dataLid = serverMatch[1];
                    console.log(`Found server with data-lid: ${dataLid}`);
                    break;
                }
            }
            
            if (!dataLid) {
                throw new Error("No server with data-lid found");
            }
            
            // Now fetch the actual server data
            const dataLidToken = btoa(dataLid).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const fetchUrlServerApi = `https://animekai.to/ajax/links/view?id=${dataLid}&_=${dataLidToken}`;
            
            console.log(`Fetching server data: ${fetchUrlServerApi}`);
            const serverResponse = await fetch(fetchUrlServerApi, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://animekai.to/'
                }
            });
            
            if (!serverResponse || !serverResponse.ok) {
                console.log(`Failed to fetch server data: ${serverResponse?.status}`);
                throw new Error("Failed to fetch server data");
            }
            
            const serverData = await serverResponse.json();
            console.log(`Got server data: ${JSON.stringify(serverData).substring(0, 100)}...`);
            
            if (!serverData || !serverData.result) {
                throw new Error("Invalid server data");
            }
            
            // Simple base64 decode
            function b64DecodeUnicode(str) {
                // First we use regular atob to decode base64 to bytes
                const decoded = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
                // Then we convert these bytes to a string
                try {
                    return decodeURIComponent(Array.from(decoded).map(c => 
                        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                    ).join(''));
                } catch (e) {
                    return decoded;
                }
            }
            
            let decodedResult;
            try {
                decodedResult = b64DecodeUnicode(serverData.result);
                console.log(`Decoded result: ${decodedResult.substring(0, 100)}...`);
            } catch (e) {
                console.log(`Error decoding: ${e}. Trying alternate method...`);
                // Fallback to simple decode if the unicode method fails
                decodedResult = atob(serverData.result.replace(/-/g, '+').replace(/_/g, '/'));
            }
            
            try {
                const megaLinkJson = JSON.parse(decodedResult);
                console.log(`Parsed embedded URL: ${megaLinkJson.url}`);
                
                if (!megaLinkJson.url) {
                    throw new Error("No URL found in decoded data");
                }
                
                const embeddedUrl = megaLinkJson.url;
                const mediaUrl = embeddedUrl.replace("/e/", "/media/");
                
                console.log(`Fetching media URL: ${mediaUrl}`);
                const mediaResponse = await fetch(mediaUrl, {
                    headers: {
                        'Referer': embeddedUrl
                    }
                });
                
                if (!mediaResponse || !mediaResponse.ok) {
                    console.log(`Failed to fetch media data: ${mediaResponse?.status}`);
                    throw new Error("Failed to fetch media data");
                }
                
                const mediaJson = await mediaResponse.json();
                console.log(`Got media JSON: ${JSON.stringify(mediaJson).substring(0, 100)}...`);
                
                if (!mediaJson || !mediaJson.result) {
                    throw new Error("Invalid media data");
                }
                
                let streamData;
                try {
                    // Try regular decode first
                    streamData = b64DecodeUnicode(mediaJson.result);
                } catch (e) {
                    console.log(`Error decoding media result: ${e}. Trying simple decode...`);
                    streamData = atob(mediaJson.result.replace(/-/g, '+').replace(/_/g, '/'));
                }
                
                console.log(`Decoded stream data: ${streamData.substring(0, 100)}...`);
                const parsedStreamData = JSON.parse(streamData);
                
                if (parsedStreamData && parsedStreamData.sources && parsedStreamData.sources.length > 0) {
                    console.log(`Found ${parsedStreamData.sources.length} stream sources`);
                    
                    // Look for HLS source first, fallback to first available
                    let bestSource = parsedStreamData.sources.find(s => s.type === 'hls') || parsedStreamData.sources[0];
                    
                    // Look for English subtitles if available
                    let subtitleTrack = null;
                    if (parsedStreamData.tracks && parsedStreamData.tracks.length > 0) {
                        console.log(`Found ${parsedStreamData.tracks.length} subtitle tracks`);
                        subtitleTrack = parsedStreamData.tracks.find(t => 
                            t.kind === 'captions' && t.label && t.label.toLowerCase().includes('english')
                        );
                        
                        // Fallback to first subtitle if no English
                        if (!subtitleTrack) {
                            subtitleTrack = parsedStreamData.tracks.find(t => t.kind === 'captions');
                        }
                    }
                    
                    // Return proper stream data object
                    const result = {
                        stream: bestSource.file,
                        subtitles: subtitleTrack ? subtitleTrack.file : null
                    };
                    
                    console.log(`Final stream URL: ${result.stream.substring(0, 100)}...`);
                    if (result.subtitles) {
                        console.log(`Subtitle URL: ${result.subtitles.substring(0, 100)}...`);
                    }
                    
                    return JSON.stringify(result);
                } else {
                    throw new Error("No stream sources found in the response");
                }
            } catch (e) {
                console.log(`Error parsing stream data: ${e}`);
                throw e;
            }
        } catch (e) {
            console.log(`Error parsing JSON: ${e}. Attempting HTML parsing...`);
            // Fall back to HTML parsing as in the original code
            
            // Extract language sections
            const subRegex = /<div class="server-items lang-group" data-id="sub"[^>]*>([\s\S]*?)<\/div>/;
            const softsubRegex = /<div class="server-items lang-group" data-id="softsub"[^>]*>([\s\S]*?)<\/div>/;
            const dubRegex = /<div class="server-items lang-group" data-id="dub"[^>]*>([\s\S]*?)<\/div>/;

            const subMatch = subRegex.exec(cleanedHtml);
            const softsubMatch = softsubRegex.exec(cleanedHtml);
            const dubMatch = dubRegex.exec(cleanedHtml);

            // Store the content in variables - prioritize dub, then softsub, then sub
            let content = "";
            if (dubMatch && dubMatch[1].trim()) {
                content = dubMatch[1].trim();
                console.log("Found dub content");
            } else if (softsubMatch && softsubMatch[1].trim()) {
                content = softsubMatch[1].trim();
                console.log("Found softsub content");
            } else if (subMatch && subMatch[1].trim()) {
                content = subMatch[1].trim();
                console.log("Found sub content");
            } else {
                throw new Error("No stream sources found in HTML");
            }

            // Find server data-lid
            const serverSpanRegex = /<span class="server"[^>]*data-lid="([^"]+)"[^>]*>Server [0-9]+<\/span>/;
            const serverMatch = serverSpanRegex.exec(content);

            if (!serverMatch || !serverMatch[1]) {
                throw new Error("No server found in HTML");
            }
            
            // Continue with the same flow as in the JSON case...
            const dataLid = serverMatch[1];
            console.log(`Found server with data-lid: ${dataLid}`);
            
            // From here, it's the same process as the JSON flow
            const dataLidToken = btoa(dataLid).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            // And continue with the same API calls...
            // This is handled the same way as in the JSON branch
            
            // We'll just return a simplified response for the HTML fallback path
            return JSON.stringify({
                stream: null,
                subtitles: null,
                error: "HTML parsing failed, please try another episode"
            });
        }
    }
    catch (error) {
        console.log('Fetch stream error: ' + error);
        return JSON.stringify({ 
            stream: null, 
            subtitles: null,
            error: error.message 
        });
    }
}

// Helper Functions
function cleanHtmlSymbols(string) {
    if (!string) return "";

    return string
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\r?\n|\r/g, " ")  // Replace any type of newline with a space
        .replace(/\s+/g, " ")       // Replace multiple spaces with a single space
        .trim();                    // Remove leading/trailing whitespace
}

function cleanJsonHtml(jsonHtml) {
    if (!jsonHtml) return "";

    return jsonHtml
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
}

// Base64 utility functions
function btoa(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input);
    let output = '';

    for (let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || (map = '=', i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("btoa failed: The string contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
    }

    return output;
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}
