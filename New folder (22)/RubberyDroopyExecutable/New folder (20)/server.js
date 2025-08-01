
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('New folder (20)'));

// Store videos and user data in JSON files
const VIDEOS_FILE = './New folder (20)/shared_videos.json';
const USERS_FILE = './New folder (20)/users_data.json';

// Initialize files if they don't exist
if (!fs.existsSync(VIDEOS_FILE)) {
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

// Helper functions
function getVideos() {
    try {
        const data = fs.readFileSync(VIDEOS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function saveVideos(videos) {
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videos, null, 2));
}

function getUsersData() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

function saveUsersData(usersData) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
}

// API Routes
// Get all videos
app.get('/api/videos', (req, res) => {
    const videos = getVideos();
    res.json(videos);
});

// Get user's unlocked videos
app.get('/api/user/:userId/unlocked', (req, res) => {
    const userId = req.params.userId;
    const usersData = getUsersData();
    const userUnlocked = usersData[userId]?.unlockedVideos || [];
    res.json(userUnlocked);
});

// Unlock video for user
app.post('/api/user/:userId/unlock/:videoId', (req, res) => {
    const userId = req.params.userId;
    const videoId = parseInt(req.params.videoId);
    
    const usersData = getUsersData();
    if (!usersData[userId]) {
        usersData[userId] = { unlockedVideos: [] };
    }
    
    if (!usersData[userId].unlockedVideos.includes(videoId)) {
        usersData[userId].unlockedVideos.push(videoId);
        saveUsersData(usersData);
    }
    
    res.json({ success: true, unlockedVideos: usersData[userId].unlockedVideos });
});

// Add new video
app.post('/api/videos', (req, res) => {
    try {
        const videos = getVideos();
        const newVideo = {
            id: Date.now(),
            ...req.body,
            uploadDate: new Date().toISOString(),
            views: req.body.views || 0
        };
        videos.push(newVideo);
        saveVideos(videos);
        
        console.log('New video added:', newVideo.title);
        res.json({ success: true, video: newVideo });
    } catch (error) {
        console.error('Error adding video:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update video (for views, etc.)
app.put('/api/videos/:id', (req, res) => {
    try {
        const videos = getVideos();
        const videoId = parseInt(req.params.id);
        const videoIndex = videos.findIndex(v => v.id === videoId);
        
        if (videoIndex !== -1) {
            videos[videoIndex] = { ...videos[videoIndex], ...req.body };
            saveVideos(videos);
            res.json({ success: true, video: videos[videoIndex] });
        } else {
            res.status(404).json({ success: false, message: 'Video not found' });
        }
    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete video
app.delete('/api/videos/:id', (req, res) => {
    try {
        const videos = getVideos();
        const videoId = parseInt(req.params.id);
        const filteredVideos = videos.filter(v => v.id !== videoId);
        saveVideos(filteredVideos);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send notification to all users
app.post('/api/send-notification', async (req, res) => {
    const { videoData, userIds } = req.body;
    const BOT_TOKEN = '7557122198:AAH4i4uGez08TA2cLqcbnG_MOoqV8nlfOz8';
    
    if (!userIds || userIds.length === 0) {
        console.log('No users found to send notifications');
        return res.json({ 
            success: true, 
            sent: 0, 
            failed: 0,
            total: 0,
            message: 'No users found'
        });
    }

    const message = `🎬 নতুন প্রিমিয়াম ভিডিও যোগ করা হয়েছে!

📹 ${videoData.title}
⏰ ${videoData.time}
🔥 ${videoData.token} টোকেন দিয়ে আনলক করুন

এখনই দেখুন: /start`;

    let successCount = 0;
    let failCount = 0;

    for (const userId of userIds) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: userId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (response.ok) {
                successCount++;
                console.log(`Notification sent to user ${userId}`);
            } else {
                failCount++;
                console.error(`Failed to send notification to user ${userId}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failCount++;
            console.error(`Error sending notification to user ${userId}:`, error);
        }
    }

    res.json({ 
        success: true, 
        sent: successCount, 
        failed: failCount,
        total: userIds.length 
    });
});

// Register user (to track users for notifications)
app.post('/api/register-user', (req, res) => {
    const { userId } = req.body;
    const usersData = getUsersData();
    
    if (!usersData[userId]) {
        usersData[userId] = {
            unlockedVideos: [],
            registeredAt: new Date().toISOString()
        };
        saveUsersData(usersData);
    }
    
    res.json({ success: true });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'New folder (20)', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'New folder (20)', 'admin', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Admin panel: http://0.0.0.0:${PORT}/admin`);
});
