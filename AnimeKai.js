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
        if (url.startsWith('#')) {
            return JSON.stringify([{
                description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
                aliases: '',
                airdate: ''
            }]);
        }

        const response = await soraFetch(url);
        
        if (!response) {
            throw new Error("Failed to fetch anime details");
        }
        
        const responseText = await response.text();
        const details = [];

        const descriptionMatch = /<div class="desc text-expand">([\s\S]*?)<\/div>/;
        let description = descriptionMatch.exec(responseText);

        const aliasesMatch = /<small class="al-title text-expand">([\s\S]*?)<\/small>/;
        let aliases = aliasesMatch.exec(responseText);
        
        // Try to extract airdate (improved from original)
        const airdateMatch = /<div class="meta"[\s\S]*?Aired:([\s\S]*?)<\/div>/;
        let airdate = airdateMatch.exec(responseText);

        details.push({
            description: description && description[1] ? cleanHtmlSymbols(description[1]) : "Not available",
            aliases: aliases && aliases[1] ? cleanHtmlSymbols(aliases[1]) : "Not available",
            airdate: airdate && airdate[1] ? cleanHtmlSymbols(airdate[1]) : "Not available"
        });

        return JSON.stringify(details);
    }
    catch (error) {
        console.log('Details error: ' + error);
        return JSON.stringify([{
            description: 'Error loading description',
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

        const response = await soraFetch(url);
        
        if (!response) {
            throw new Error("Failed to fetch episode data");
        }
        
        const responseText = await response.text();

        // Extract anime ID - this is the critical part
        const rateBoxIdRegex = /<div class="rate-box"[^>]*data-id="([^"]+)"/;
        const idMatch = responseText.match(rateBoxIdRegex);
        const aniId = idMatch ? idMatch[1] : null;
        
        if (!aniId) {
            throw new Error("Could not find anime ID on page");
        }
        
        // Use our built-in encoder instead of loading from GitHub
        const urlFetchToken = KAICODEX_MINI.enc(aniId);
        
        // Get episode list
        const fetchUrlListApi = `https://animekai.to/ajax/episodes/list?ani_id=${aniId}&_=${urlFetchToken}`;
        const episodeResponse = await soraFetch(fetchUrlListApi);
        
        if (!episodeResponse) {
            throw new Error("Failed to fetch episode list");
        }
        
        const data = await episodeResponse.json();
        
        if (!data || !data.result) {
            throw new Error("Invalid episode list data");
        }
        
        const htmlContentListApi = cleanJsonHtml(data.result);
        const episodes = [];

        // Extract episode data
        const episodeRegex = /<a[^>]+num="([^"]+)"[^>]+token="([^"]+)"[^>]*>/g;
        let epMatch;

        while ((epMatch = episodeRegex.exec(htmlContentListApi)) !== null) {
            const num = epMatch[1];
            const token = epMatch[2];
            const tokenEncoded = KAICODEX_MINI.enc(token);
            const episodeUrl = `https://animekai.to/ajax/links/list?token=${token}&_=${tokenEncoded}`;

            episodes.push({
                href: episodeUrl,
                number: parseInt(num, 10)
            });
        }

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
        const response = await soraFetch(url);
        
        if (!response) {
            throw new Error("Failed to fetch stream data");
        }
        
        const text = await response.text();
        const cleanedHtml = cleanJsonHtml(text);

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
        } else if (softsubMatch && softsubMatch[1].trim()) {
            content = softsubMatch[1].trim();
        } else if (subMatch && subMatch[1].trim()) {
            content = subMatch[1].trim();
        } else {
            throw new Error("No stream sources found");
        }

        // Find server data-lid
        const serverSpanRegex = /<span class="server"[^>]*data-lid="([^"]+)"[^>]*>Server [0-9]+<\/span>/;
        const serverMatch = serverSpanRegex.exec(content);

        if (!serverMatch || !serverMatch[1]) {
            throw new Error("No server found");
        }
        
        const dataLid = serverMatch[1];
        const dataLidToken = KAICODEX_MINI.enc(dataLid);
        const fetchUrlServerApi = `https://animekai.to/ajax/links/view?id=${dataLid}&_=${dataLidToken}`;

        const serverResponse = await soraFetch(fetchUrlServerApi);
        
        if (!serverResponse) {
            throw new Error("Failed to fetch server data");
        }
        
        const dataServerApi = await serverResponse.json();
        
        if (!dataServerApi || !dataServerApi.result) {
            throw new Error("Invalid server data");
        }

        const decodedResult = KAICODEX_MINI.dec(dataServerApi.result);
        
        try {
            const megaLinkJson = JSON.parse(decodedResult);
            const embeddedUrl = megaLinkJson.url;
            const mediaUrl = embeddedUrl.replace("/e/", "/media/");

            // Fetch the media url
            const mediaResponse = await soraFetch(mediaUrl);
            
            if (!mediaResponse) {
                throw new Error("Failed to fetch media data");
            }
            
            const mediaJson = await mediaResponse.json();
            
            if (!mediaJson || !mediaJson.result) {
                throw new Error("Invalid media data");
            }

            const streamUrlJson = KAICODEX_MINI.decMega(mediaJson.result);
            const parsedStreamData = JSON.parse(streamUrlJson);

            if (parsedStreamData && parsedStreamData.sources && parsedStreamData.sources.length > 0) {
                // Return proper stream data object similar to AniCrush
                return JSON.stringify({
                    stream: parsedStreamData.sources[0].file,
                    subtitles: parsedStreamData.tracks && parsedStreamData.tracks.length > 0 ? 
                        parsedStreamData.tracks[0].file : null
                });
            } else {
                throw new Error("No stream sources found in the response");
            }
        } catch (e) {
            console.log("Error parsing stream data: " + e);
            throw e;
        }
    }
    catch (error) {
        console.log('Fetch stream error: ' + error);
        return JSON.stringify({ stream: null, subtitles: null });
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
