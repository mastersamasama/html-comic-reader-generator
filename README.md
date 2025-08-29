# 📚 Manga Server - High-Performance Manga Reading System

A blazingly fast manga reading server that automatically generates beautiful bookshelf and reader pages for your manga collection.

## 🎯 What Does It Do?

This system creates:
- **📖 A Beautiful Bookshelf** - Browse all your manga in one place
- **📱 Mobile-Optimized Readers** - Read manga on any device
- **⚡ Lightning-Fast Server** - Instant page loading with smart caching
- **🔄 Real-Time Progress Sync** - Continue reading across devices

## 🚀 Quick Start

### Requirements
- [Bun](https://bun.sh) (JavaScript runtime)
- Python 3.x (for HTML generation)
- Your manga collection organized in folders

### Installation

1. **Download and Extract**
   ```bash
   git clone https://github.com/yourusername/manga-server.git
   cd manga-server
   ```

2. **Quick Setup** (One command to rule them all!)
   ```bash
   bun run quick-setup
   ```
   This will:
   - Set up the server
   - Generate your manga bookshelf
   - Start the server at http://localhost

3. **Open Your Browser**
   
   Navigate to `http://localhost` to see your manga bookshelf!

## 📁 Organizing Your Manga

Place your manga in the `manga-collection` folder with this structure:

```
manga-collection/
├── 0001.One Piece/
│   ├── 001.jpg
│   ├── 002.jpg
│   └── ...
├── 0002.Naruto/
│   ├── 001.jpg
│   ├── 002.jpg
│   └── ...
└── 0003.Attack on Titan/
    ├── Chapter 1/
    │   ├── 001.jpg
    │   └── ...
    └── Chapter 2/
        └── ...
```

## 🎨 Generating Your Manga Library

### Generate Everything at Once
```bash
bun run full-gen
```
This creates your bookshelf and all manga readers automatically!

### Generate Individual Components

**Create/Update Bookshelf:**
```bash
bun run genshelf
```
This creates `index.html` - your main bookshelf page. And default to creates reader pages for all manga in your collection.

**Generate Reader for Specific Manga:**
```bash
bun run genreader
```
This creates a reader page for a specific manga.

## 🖥️ Using the Server

### Start the Server
```bash
bun run start
```
Your manga library is now available at `http://localhost`

### Other Server Commands

**Development Mode** (auto-reload on changes):

```bash
bun run dev
```

**Production Mode** (optimized performance):
```bash
bun run serve-prod
```

**Check Server Health:**

```bash
bun run health
```

## 📱 Reading Your Manga

### From the Bookshelf
1. Open `http://localhost` in your browser
2. Click on any manga cover to open its reader
3. Use the navigation controls to read

### Reader Features
- **📱 Mobile Optimized** - Swipe or tap to navigate
- **🖥️ Desktop Friendly** - Keyboard shortcuts (arrow keys)
- **🔍 Zoom Controls** - Pinch to zoom on mobile
- **🌙 Dark Mode** - Easy on the eyes for night reading

### Keyboard Shortcuts
- `→` or `Space` - Next page
- `←` - Previous page  
- `F` - Fullscreen mode
- `ESC` - Exit fullscreen

## 🔄 Updating Your Library

When you add new manga:

1. **Add manga to the collection folder**
2. **Regenerate the bookshelf:**
   ```bash
   bun run genshelf
   ```
3. **Refresh your browser** - New manga appears!

## 🌐 Network Access

### Access from Other Devices

To read manga on your phone/tablet while the server runs on your computer:

1. Find your computer's IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig`

2. On your mobile device, open:
   ```
   http://[YOUR-COMPUTER-IP]
   ```
   Example: `http://192.168.1.100`

### Port Configuration

Default port is 80. To use a different port:

**Windows (PowerShell):**
```powershell
$env:PORT=3000; bun run start
```

**Windows (Command Prompt):**
```cmd
set PORT=3000 && bun run start
```

**Linux/Mac:**
```bash
PORT=3000 bun run start
```

Then access at `http://localhost:3000`

## 🎯 Common Use Cases

### Adding New Manga
1. Copy manga folder to `manga-collection/`
2. Run `bun run genshelf` to update bookshelf
3. Run `bun run genreader` to create reader

### Batch Processing
Update everything after adding multiple manga:
```bash
bun run genshelf

Collection path (Enter for default './本'): path-to-your-manga (absolute or relative)
Generate reader files? (Y/n):
Output filename (default: index.html):
```

### Reading Offline
The generated HTML files work offline! Just open `index.html` directly in your browser.

### Portable Setup
Copy the entire folder to a USB drive and run from any computer with Bun installed.

## ⚙️ Configuration

### Change Manga Folder Location

**Windows (PowerShell):**
```powershell
$env:MANGA_ROOT="D:/MyManga"; bun run start
```

**Windows (Command Prompt):**
```cmd
set MANGA_ROOT=D:/MyManga && bun run start
```

**Linux/Mac:**
```bash
MANGA_ROOT="D:/MyManga" bun run start
```

### Performance Settings

For slower computers (reduce cache size):

**Windows (PowerShell):**
```powershell
$env:CACHE_SIZE_MB=256; bun run start
```

**Windows (Command Prompt):**
```cmd
set CACHE_SIZE_MB=256 && bun run start
```

**Linux/Mac:**
```bash
CACHE_SIZE_MB=256 bun run start
```

For powerful computers (increase performance):

**Windows (PowerShell):**
```powershell
$env:CACHE_SIZE_MB=2048; $env:MAX_CONNECTIONS=10000; bun run start
```

**Windows (Command Prompt):**
```cmd
set CACHE_SIZE_MB=2048 && set MAX_CONNECTIONS=10000 && bun run start
```

**Linux/Mac:**
```bash
CACHE_SIZE_MB=2048 MAX_CONNECTIONS=10000 bun run start
```

## 🆘 Troubleshooting

### Server Won't Start
- **Port in use?** Try: `PORT=3000 bun run start`
- **Permission denied?** Run as administrator (Windows) or use `sudo` (Linux/Mac)

### Manga Not Showing
- Check folder naming (should be like `0001.MangaName`)
- Ensure images are in `.jpg`, `.png`, or `.webp` format
- Run `bun run rebuild-index` to refresh the index

### Slow Performance
- Reduce cache size: `CACHE_SIZE_MB=256 bun run start`
- Close other applications to free up memory
- Use production mode: `bun run serve-prod`

### Can't Access from Phone
- Ensure both devices are on the same network
- Check firewall settings (allow port 80)
- Try using your computer's IP address instead of `localhost`

## 📝 File Structure After Setup

```
manga-server/
manga-collection/           # Your manga folders
├── index.html              # Generated bookshelf
└── [manga folders]/
    └── index-mb.html       # Generated reader for each manga
```

## 🎉 Tips for Best Experience

1. **Organize by Series** - Use numbered prefixes (0001, 0002) for sorting
2. **Consistent Naming** - Keep image names sequential (001.jpg, 002.jpg)
3. **Image Quality** - Balance quality and file size (1200px width recommended)
4. **Regular Updates** - Run `bun run genshelf` after adding new manga

## 📱 Mobile App Feel

Add to your phone's home screen:
1. Open `http://[your-ip]` in mobile browser
2. Tap "Add to Home Screen"
3. Now you have a manga app icon!

## 🤝 Getting Help

If you encounter issues:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Run `bun run health` to check server status
3. Look at server logs in the console
4. Open an issue on GitHub

## 📄 License

MIT License - Use freely for personal manga reading!

---

<div align="center">
  <b>Enjoy reading your manga collection! 📚</b>
  <br>
  <sub>Built for manga lovers, by manga lovers</sub>
</div>
