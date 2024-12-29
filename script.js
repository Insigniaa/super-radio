// Constants
const STATION_NAME = 'super-radio';
const BASE_URL = 'https://api.laut.fm';
const STREAM_URL = `https://stream.laut.fm/${STATION_NAME}`;
const DEFAULT_TRACK_IMAGE = 'https://placehold.co/400x400/333/FFF?text=Music';
const LASTFM_API_KEY = '6356e58cb76c89948047da715c61c707';
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
const newsContainer = document.querySelector('.news-grid');

// DOM Elements
const currentTrackTitle = document.querySelector('.track-details h1');
const currentTrackArtist = document.querySelector('.track-details p');
const currentTrackImage = document.querySelector('.track-artwork img');
const playPauseBtn = document.querySelector('.play-pause-btn');
const volumeSlider = document.querySelector('#volumeSlider');
const progressBar = document.querySelector('.progress');
const recentTracksContainer = document.querySelector('.tracks-grid');
const refreshBtn = document.querySelector('.refresh-btn');
const listenLiveBtn = document.querySelector('.listen-live-btn');

// Audio Player
const audioPlayer = new Audio(STREAM_URL);
let isPlaying = false;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing player...');
    initializePlayer();
    updateAllTracks();
    updateMusicNews();
    startProgressUpdate();
    // Start periodic updates
    setInterval(updateAllTracks, 30000); // Update every 30 seconds
    setInterval(updateMusicNews, 300000); // Update news every 5 minutes
});

playPauseBtn.addEventListener('click', togglePlayPause);
listenLiveBtn.addEventListener('click', togglePlayPause);
volumeSlider.addEventListener('input', updateVolume);
refreshBtn.addEventListener('click', handleRefresh);

// Player Functions
function initializePlayer() {
    // Load saved volume or set default
    const savedVolume = localStorage.getItem('playerVolume') || '80';
    volumeSlider.value = savedVolume;
    audioPlayer.volume = savedVolume / 100;
    updatePlayPauseButton();
}

function togglePlayPause() {
    if (isPlaying) {
        audioPlayer.pause();
    } else {
        audioPlayer.play().catch(error => {
            console.error('Error playing stream:', error);
        });
    }
    isPlaying = !isPlaying;
    updatePlayPauseButton();
}

function updatePlayPauseButton() {
    // Update footer play button
    playPauseBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    playPauseBtn.classList.toggle('playing', isPlaying);
    
    // Update Listen Live button
    listenLiveBtn.innerHTML = isPlaying ? 
        '<i class="fas fa-pause"></i> Pause' : 
        '<i class="fas fa-broadcast-tower"></i> Listen Live';
    listenLiveBtn.classList.toggle('playing', isPlaying);
}

function updateVolume() {
    const volume = volumeSlider.value;
    audioPlayer.volume = volume / 100;
    localStorage.setItem('playerVolume', volume);
}

function startProgressUpdate() {
    setInterval(() => {
        if (isPlaying) {
            // For live streams, simulate progress
            const currentWidth = parseFloat(progressBar.style.width) || 0;
            const newWidth = (currentWidth + 1) % 100;
            progressBar.style.width = `${newWidth}%`;
        }
    }, 1000);
}

// Track Management
async function updateAllTracks() {
    try {
        const timestamp = new Date().getTime(); // Add timestamp for cache busting
        console.log('Fetching current song...', timestamp);
        
        // Direct API calls without CORS proxy
        const currentResponse = await fetch(`${BASE_URL}/station/${STATION_NAME}/current_song?t=${timestamp}`, {
            mode: 'cors', // Enable CORS
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!currentResponse.ok) {
            console.error('Current song response not OK:', currentResponse.status);
            throw new Error('Failed to fetch current track');
        }
        
        const currentTrack = await currentResponse.json();
        console.log('Current track data:', currentTrack);

        // Fetch recent tracks
        const recentResponse = await fetch(`${BASE_URL}/station/${STATION_NAME}/last_songs?t=${timestamp}`, {
            mode: 'cors', // Enable CORS
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!recentResponse.ok) throw new Error('Failed to fetch recent tracks');
        const recentTracks = await recentResponse.json();

        // Update current track display
        if (currentTrack) {
            console.log('Updating current track display...');
            const trackInfo = {
                title: currentTrack.title || 'Unknown Track',
                artist: currentTrack.artist?.name || 'Unknown Artist',
                image: currentTrack.artist?.thumb || DEFAULT_TRACK_IMAGE,
                startedAt: currentTrack.started_at,
                endsAt: currentTrack.ends_at
            };
            console.log('Track info:', trackInfo);
            updateCurrentTrack(trackInfo);
        }

        // Display recent tracks
        if (Array.isArray(recentTracks)) {
            displayRecentTracks(recentTracks.map(track => ({
                title: track.title || 'Unknown Track',
                artist: track.artist?.name || 'Unknown Artist',
                image: track.artist?.thumb || DEFAULT_TRACK_IMAGE,
                startedAt: track.started_at
            })));
        }

        // Update document title
        if (currentTrack) {
            document.title = `${currentTrack.title} - ${currentTrack.artist?.name || 'Unknown Artist'} | Super Radio`;
        }
    } catch (error) {
        console.error('Error updating tracks:', error);
        
        // Detailed error logging
        console.warn('Unable to fetch track information. Check network connection or API availability.');
        
        const fallbackTrack = {
            title: 'Live Stream',
            artist: 'Super Radio',
            image: DEFAULT_TRACK_IMAGE
        };
        updateCurrentTrack(fallbackTrack);
        displayRecentTracks([fallbackTrack]);
    }
}

async function getTrackImage(title, artist) {
    if (!LASTFM_API_KEY) return DEFAULT_TRACK_IMAGE;
    
    // Clean up the title and artist strings
    title = title.replace(/\+$/, '').trim(); // Remove trailing + and trim
    artist = artist.replace(/^super(-|\s)?radio$/i, '').trim(); // Remove station name if it's the artist
    
    // If it looks like a radio show title (e.g., "De jaren 80"), use a specific image
    if (title.toLowerCase().includes('jaren') || title.toLowerCase().includes('zone')) {
        return 'https://placehold.co/400x400/ff1e8c/FFF?text=' + encodeURIComponent(title);
    }
    
    // If we don't have meaningful artist/title data, return a styled placeholder
    if (!artist || !title || artist === 'Unknown Artist' || title === 'Unknown Track') {
        return DEFAULT_TRACK_IMAGE;
    }
    
    try {
        // Try to get track info first
        const response = await fetch(
            `${LASTFM_BASE_URL}?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.track && data.track.album && data.track.album.image) {
                const images = data.track.album.image;
                const largeImage = images.find(img => img.size === 'extralarge');
                if (largeImage && largeImage['#text']) {
                    return largeImage['#text'];
                }
            }
        }
        
        // If no track image, try artist image
        const artistResponse = await fetch(
            `${LASTFM_BASE_URL}?method=artist.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&format=json`
        );
        
        if (artistResponse.ok) {
            const artistData = await artistResponse.json();
            if (artistData.artist && artistData.artist.image) {
                const images = artistData.artist.image;
                const largeImage = images.find(img => img.size === 'extralarge');
                if (largeImage && largeImage['#text']) {
                    return largeImage['#text'];
                }
            }
        }
        
        // If no images found, create a styled placeholder with the title
        return `https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(title)}`;
    } catch (error) {
        console.error('Error fetching track image:', error);
        // Return a styled placeholder with the title
        return `https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(title)}`;
    }
}

async function updateCurrentTrack(track) {
    console.log('Updating DOM with track:', track);
    
    // Get track image from Last.fm
    const trackImage = await getTrackImage(track.title, track.artist);
    
    // Update main track info
    if (currentTrackTitle) {
        console.log('Updating title:', track.title);
        currentTrackTitle.textContent = track.title;
    }
    
    if (currentTrackArtist) {
        console.log('Updating artist:', track.artist);
        currentTrackArtist.textContent = track.artist;
    }
    
    if (currentTrackImage) {
        console.log('Updating image:', trackImage);
        currentTrackImage.src = trackImage;
        currentTrackImage.onerror = () => {
            currentTrackImage.src = `https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(track.title)}`;
        };
    }

    // Update hero section artwork
    const heroArtwork = document.querySelector('.track-artwork img');
    if (heroArtwork) {
        heroArtwork.src = trackImage;
        heroArtwork.onerror = () => {
            heroArtwork.src = `https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(track.title)}`;
        };
    }

    // Update hero background with a blurred version
    const heroBackground = document.querySelector('.hero-background');
    if (heroBackground) {
        heroBackground.style.backgroundImage = `linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url('${trackImage}')`;
    }

    // Update player bar info
    const playerTrackTitle = document.querySelector('.track-title');
    const playerTrackArtist = document.querySelector('.track-artist');
    const playerTrackImg = document.querySelector('.current-track-img');

    if (playerTrackTitle) {
        playerTrackTitle.textContent = track.title;
    }
    
    if (playerTrackArtist) {
        playerTrackArtist.textContent = track.artist;
    }
    
    if (playerTrackImg) {
        playerTrackImg.src = trackImage;
        playerTrackImg.onerror = () => {
            playerTrackImg.src = `https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(track.title)}`;
        };
    }
}

async function displayRecentTracks(tracks) {
    if (!recentTracksContainer) return;

    const trackElements = await Promise.all(tracks.slice(0, 5).map(async track => {
        const startTime = track.startedAt ? new Date(track.startedAt).toLocaleTimeString() : '';
        const trackImage = await getTrackImage(track.title, track.artist);
    return `
            <div class="track-item">
                <img src="${trackImage}" alt="${track.title}" 
                     onerror="this.src='https://placehold.co/400x400/ff1e8c/FFF?text=${encodeURIComponent(track.title)}'">
                <div class="track-item-info">
                    <div class="track-item-title">${track.title}</div>
                    <div class="track-item-artist">${track.artist}</div>
                    ${startTime ? `<div class="track-item-time">${startTime}</div>` : ''}
            </div>
        </div>
    `;
    }));

    recentTracksContainer.innerHTML = trackElements.join('');
}

async function handleRefresh() {
    const btn = document.querySelector('.refresh-btn');
    btn.classList.add('rotating');
    await updateAllTracks();
    setTimeout(() => btn.classList.remove('rotating'), 1000);
}

// Error Handling
audioPlayer.addEventListener('error', (e) => {
    console.error('Audio player error:', e);
    isPlaying = false;
    updatePlayPauseButton();
});

// Handle network status changes
window.addEventListener('online', () => {
    console.log('Connection restored, attempting to resume playback...');
    if (isPlaying) {
        audioPlayer.play().catch(console.error);
    }
});

window.addEventListener('offline', () => {
    console.log('Connection lost, pausing playback...');
    audioPlayer.pause();
    isPlaying = false;
    updatePlayPauseButton();
});

async function updateMusicNews() {
    try {
        const newsItems = await fetchNuNLNews();
        displayNews(newsItems.slice(0, 6)); // Display up to 6 news items
    } catch (error) {
        console.error('Error updating music news:', error);
    }
}

async function fetchNuNLNews() {
    try {
        // Use a CORS proxy to fetch the RSS feed
        const response = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.nu.nl/rss/Achterklap'));
        if (!response.ok) return [];
        
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');
        
        return Array.from(items).map(item => {
            // Extract the image URL from the enclosure or media:content if available
            let imageUrl = DEFAULT_TRACK_IMAGE;
            
            // Try to get image from enclosure
            const enclosure = item.querySelector('enclosure');
            if (enclosure && enclosure.getAttribute('type')?.startsWith('image/')) {
                imageUrl = enclosure.getAttribute('url');
            }
            
            // If no enclosure, try to get from media:content
            if (imageUrl === DEFAULT_TRACK_IMAGE) {
                const mediaContent = item.querySelector('media\\:content, content');
                if (mediaContent && mediaContent.getAttribute('type')?.startsWith('image/')) {
                    imageUrl = mediaContent.getAttribute('url');
                }
            }
            
            // If still no image, try to get from description
            if (imageUrl === DEFAULT_TRACK_IMAGE) {
                const content = item.querySelector('description')?.textContent || '';
                const imgMatch = content.match(/src="([^"]+)"/);
                if (imgMatch) {
                    imageUrl = imgMatch[1];
                }
                
                // Check for copyright photo tag
                const copyrightMatch = content.match(/copyright photo: ([^<]+)/);
                if (copyrightMatch) {
                    imageUrl = copyrightMatch[1];
                }
            }

            // Clean up the content by removing HTML tags
            const content = item.querySelector('description')?.textContent || '';
            const cleanContent = content
                .replace(/<[^>]+>/g, '') // Remove HTML tags
                .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
                .replace(/copyright photo: [^<]+/g, '') // Remove copyright photo text
                .trim();

            return {
                title: item.querySelector('title')?.textContent || 'Geen titel',
                content: cleanContent || 'Geen beschrijving beschikbaar',
                image: imageUrl,
                date: new Date(item.querySelector('pubDate')?.textContent || new Date()),
                source: 'NU.nl Achterklap',
                url: item.querySelector('link')?.textContent || '#'
            };
        });
    } catch (error) {
        console.error('Error fetching NU.nl news:', error);
        return [];
    }
}

function displayNews(newsItems) {
    if (!newsContainer) return;

    const newsHTML = newsItems.map(news => `
        <article class="news-item" onclick="window.open('${news.url}', '_blank')">
            <img class="news-image" src="${news.image}" alt="${news.title}"
                 onerror="this.src='${DEFAULT_TRACK_IMAGE}'">
            <div class="news-content">
                <div class="news-date">${news.date.toLocaleDateString('nl-NL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</div>
                <h3 class="news-title">${news.title}</h3>
                <p class="news-excerpt">${news.content}</p>
                <div class="news-source">
                    <i class="fas fa-external-link-alt"></i>
                    ${news.source}
                </div>
            </div>
        </article>
    `).join('');

    newsContainer.innerHTML = newsHTML;
}
