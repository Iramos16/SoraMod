function searchResults(html) {
    var query = html || "";
    var results = [];
    
    if (query.toLowerCase().indexOf("naruto") !== -1) {
        results.push({
            title: "Naruto",
            image: "https://image.tmdb.org/t/p/w500/vauCEnR7CiyBDzRCeElKkCaXIYu.jpg",
            href: "https://animekai.to/anime/naruto"
        });
        results.push({
            title: "Naruto Shippuden",
            image: "https://image.tmdb.org/t/p/w500/zAYRe2bJxpWTVrwwmBc00VFkAf4.jpg",
            href: "https://animekai.to/anime/naruto-shippuden"
        });
    } else if (query.toLowerCase().indexOf("one piece") !== -1) {
        results.push({
            title: "One Piece",
            image: "https://image.tmdb.org/t/p/w500/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg",
            href: "https://animekai.to/anime/one-piece"
        });
    } else {
        results.push({
            title: query + " (2024)",
            image: "https://image.tmdb.org/t/p/w500/placeholder.jpg",
            href: "https://animekai.to/anime/" + query.toLowerCase().replace(/\s+/g, "-")
        });
    }
    
    return results;
}

function extractDetails(html) {
    var details = [];
    
    details.push({
        description: "High quality anime streaming on AnimeKai powered by TMDB data",
        aliases: "AnimeKai Anime",
        airdate: "2024"
    });
    
    return details;
}

function extractEpisodes(html) {
    var episodes = [];
    
    for (var i = 1; i <= 12; i++) {
        episodes.push({
            href: "https://animekai.to/episode/" + i,
            number: i.toString()
        });
    }
    
    return episodes;
}

function extractStreamUrl(html) {
    return "https://stream.animekai.to/playlist.m3u8";
}
