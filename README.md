# 📚 Manga Server - High-Performance Manga Reading System

A high-performance, self-configuring manga reading server that automatically detects your system specifications and optimizes itself for peak performance. Generate beautiful bookshelf and reader pages for your manga collection with zero configuration required.

## 🎯 What Does It Do?

This system creates:
- **📖 A Beautiful Bookshelf** - Browse all your manga in one place
- **📱 Mobile-Optimized Readers** - Read manga on any device  
- **⚡ Lightning-Fast Server** - Auto-configured for your hardware with smart caching
- **🔄 Real-Time Progress Sync** - Continue reading across devices
- **🤖 Smart Auto-Configuration** - Detects your PC specs and optimizes performance automatically

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

2. **Smart Setup** (Automatically configures for your system!)
   ```bash
   bun run quick-setup
   ```
   This will:
   - **Auto-detect** your system specifications (CPU, RAM, storage)
   - **Optimize** server settings for peak performance
   - **Generate** your manga bookshelf
   - **Configure** everything automatically based on your hardware

3. **Open Your Browser**
   
   Navigate to `http://localhost` to see your manga bookshelf!

## 🤖 Auto-Configuration System

The manga server includes an intelligent auto-configuration system that detects your PC specifications and optimizes performance automatically.

### 🔧 Configuration Methods

**Automatic Configuration** (Recommended)
```bash
bun run config:auto
```
- Detects CPU cores, RAM, and storage type
- Runs performance benchmarks
- Sets optimal cache size and connection limits
- Creates configuration files automatically

**Interactive Configuration**
```bash
bun run config:wizard
```
- Guided setup with system detection
- Customize manga collection path
- Choose performance settings
- Preview configuration before applying

**View Current Configuration**
```bash
bun run config:show
```

**Reset Configuration**
```bash
bun run config:reset
```

### 🎯 Performance Tiers

The system automatically classifies your hardware into performance tiers:

| Tier | System Requirements | Optimized Settings |
|------|-------------------|-------------------|
| **🟢 Low** | <4GB RAM, <4 CPU cores | 256MB cache, 100 connections |
| **🟡 Medium** | 4-8GB RAM, 4-8 cores | 1GB cache, 5,000 connections |
| **🟠 High** | 8-16GB RAM, 8-16 cores | 4GB cache, 20,000 connections |
| **🔴 Extreme** | >16GB RAM, >16 cores | 8GB cache, 100,000+ connections |

### 📊 What Gets Detected

- **CPU**: Core count, speed, architecture
- **Memory**: Total RAM, available memory, usage patterns  
- **Storage**: SSD vs HDD, read/write speeds, available space
- **Network**: Interface types, bandwidth capabilities
- **Performance**: Benchmark scores, system responsiveness

### ⚙️ Configuration Files

After auto-configuration, you'll find these files:

- `manga-server/config/auto-config.json` - Generated optimal settings
- `manga-server/config/user-config.json` - Your custom overrides  
- `manga-server/config/.env` - Environment variables for the server

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

## ⚙️ Configuration & Environment Variables

The server uses environment variables for configuration. These can be set in the `.env` file (auto-generated) or as system environment variables.

### 📋 Environment Variables Reference

#### Core Server Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 80 | Server port number |
| `HOSTNAME` | 0.0.0.0 | Server hostname (0.0.0.0 = all interfaces, localhost = local only) |
| `NODE_ENV` | auto | Environment mode: development, production, or auto |

#### Performance Settings
| Variable | Auto-Detected | Description |
|----------|---------------|-------------|
| `CACHE_SIZE_MB` | 256-8192 | Memory cache size in megabytes |
| `MAX_CONNECTIONS` | 100-100000 | Maximum concurrent connections |
| `WORKER_THREADS` | 2-16 | Number of worker threads (usually = CPU cores) |
| `STREAMING_THRESHOLD` | 8192-65536 | File size threshold for streaming (bytes) |
| `COMPRESSION_THRESHOLD` | 65536-1048576 | File size threshold for compression (bytes) |

#### Memory Management
| Variable | Auto-Detected | Description |
|----------|---------------|-------------|
| `MEMORY_LIMIT_MB` | 512-16384 | Maximum memory usage limit |
| `GC_INTERVAL` | 5000-60000 | Garbage collection interval (milliseconds) |
| `MEMORY_POOL_MB` | 64-2048 | Memory pool size for optimizations |

#### Feature Toggles
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_COMPRESSION` | true/false | Enable file compression |
| `ENABLE_STREAMING` | true | Enable streaming for large files |
| `ENABLE_CACHING` | true | Enable memory caching |
| `ENABLE_WEBSOCKET` | true/false | Enable WebSocket for progress sync |
| `ENABLE_METRICS` | true/false | Enable performance metrics collection |

#### Network & Timeouts
| Variable | Default | Description |
|----------|---------|-------------|
| `KEEP_ALIVE_TIMEOUT` | 5000-60000 | Connection keep-alive timeout (ms) |
| `REQUEST_TIMEOUT` | 30000-300000 | Request timeout (ms) |
| `UPLOAD_LIMIT_MB` | 10-500 | Maximum upload size |

#### Paths & Directories
| Variable | Default | Description |
|----------|---------|-------------|
| `MANGA_ROOT` | ./manga-collection | Path to your manga collection |
| `DATA_PATH` | ./manga-server/data | Server data directory |
| `LOGS_PATH` | ./manga-server/logs | Server logs directory |

#### Auto-Tuning
| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_TUNING` | true | Enable automatic performance adjustments |
| `PERFORMANCE_MODE` | balanced | Performance mode: conservative, balanced, aggressive, extreme |

### 📁 Manual Configuration

**Example: Custom Manga Folder**
```bash
# Set manga collection path
MANGA_ROOT="/path/to/your/manga" bun run start

# Or edit the .env file directly
echo "MANGA_ROOT=/path/to/your/manga" >> manga-server/config/.env
```

**Example: Performance Tuning**
```bash
# High performance setup
CACHE_SIZE_MB=4096 MAX_CONNECTIONS=20000 bun run start

# Low resource setup  
CACHE_SIZE_MB=256 MAX_CONNECTIONS=1000 bun run start

# Development mode
NODE_ENV=development PORT=3000 bun run start
```

**Example: Feature Configuration**
```bash
# Disable compression for faster startup
ENABLE_COMPRESSION=false bun run start

# Enable all features
ENABLE_WEBSOCKET=true ENABLE_METRICS=true bun run start
```

### 🔧 .env File Example

After running auto-configuration, your `.env` file might look like:

```bash
# Auto-generated configuration for HIGH performance tier
PORT=80
HOSTNAME=0.0.0.0
NODE_ENV=production
CACHE_SIZE_MB=4096
MAX_CONNECTIONS=20000
WORKER_THREADS=8
STREAMING_THRESHOLD=16384
COMPRESSION_THRESHOLD=131072
MEMORY_LIMIT_MB=8192
GC_INTERVAL=15000
MEMORY_POOL_MB=1024
KEEP_ALIVE_TIMEOUT=30000
REQUEST_TIMEOUT=120000
UPLOAD_LIMIT_MB=100
ENABLE_COMPRESSION=true
ENABLE_STREAMING=true
ENABLE_CACHING=true
ENABLE_WEBSOCKET=true
ENABLE_METRICS=true
MANGA_ROOT=./manga-collection
DATA_PATH=./manga-server/data
LOGS_PATH=./manga-server/logs
AUTO_TUNING=true
PERFORMANCE_MODE=aggressive
```

### 🎛️ Performance Mode Explained

| Mode | Use Case | Resource Usage | Features |
|------|----------|----------------|----------|
| **Conservative** | Low-end systems, shared computers | Minimal CPU/RAM | Basic features only |
| **Balanced** | General use, most systems | Moderate resources | Most features enabled |
| **Aggressive** | Gaming PCs, workstations | High resources | All features, optimized |
| **Extreme** | Server hardware, 64GB+ RAM | Maximum resources | Everything enabled |

## 🆘 Troubleshooting

### Configuration Issues

**❌ Auto-Configuration Failed**
```bash
# Try interactive mode for manual setup
bun run config:wizard

# Or reset and try again
bun run config:reset
bun run config:auto
```

**❌ System Detection Problems**
```bash
# Check detection manually
bun run config:auto --test

# Force reconfiguration
bun run config:auto --force
```

**❌ Performance Too Low**
```bash
# Check your detected tier
bun run config:show

# Manually set higher performance
CACHE_SIZE_MB=2048 MAX_CONNECTIONS=10000 bun run start
```

**❌ Out of Memory Errors**
```bash
# Reduce memory usage
CACHE_SIZE_MB=256 PERFORMANCE_MODE=conservative bun run start

# Or reconfigure for your system
bun run config:auto --force
```

### Server Issues

**❌ Server Won't Start**
- **Port in use?** Try: `PORT=3000 bun run start`
- **Permission denied?** Run as administrator (Windows) or use `sudo` (Linux/Mac)
- **Configuration error?** Run: `bun run config:reset` then `bun run config:auto`

**❌ Manga Not Showing**
- Check folder naming (should be like `0001.MangaName`)
- Ensure images are in `.jpg`, `.png`, or `.webp` format  
- Verify manga path: Check `MANGA_ROOT` in your `.env` file
- Run `bun run rebuild-index` to refresh the index

**❌ Slow Performance**
- **Check your configuration tier**: `bun run config:show`
- **Low-end system**: `PERFORMANCE_MODE=conservative bun run start`
- **High-end system not detected**: `bun run config:auto --force`
- **Memory issues**: Close other applications
- **Disk slow**: Check if using HDD vs SSD in configuration

**❌ Can't Access from Phone**
- Ensure both devices are on the same network
- Check `HOSTNAME` setting (should be `0.0.0.0` not `localhost`)
- Check firewall settings (allow the configured port)
- Try using your computer's IP address: `http://[YOUR-IP]:[PORT]`

### Environment Variable Issues

**❌ .env File Not Loading**
```bash
# Check if file exists
ls manga-server/config/.env

# Recreate with auto-config
bun run config:auto --force
```

**❌ Wrong Settings Applied**
```bash
# Check what's actually loaded
bun run config:show

# Reset and reconfigure
bun run config:reset
bun run config:wizard
```

**❌ Path Problems**
```bash
# Check current paths
bun run config:show | grep PATH

# Update manga path
echo "MANGA_ROOT=/new/path/to/manga" >> manga-server/config/.env
```

### Performance Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Server crashes | Memory limit too high | Reduce `CACHE_SIZE_MB` and `MEMORY_LIMIT_MB` |
| Slow loading | Cache too small | Increase `CACHE_SIZE_MB` if you have RAM |
| Connection errors | Max connections too high | Reduce `MAX_CONNECTIONS` |
| High CPU usage | Too many worker threads | Reduce `WORKER_THREADS` to match CPU cores |
| Out of disk space | Large cache on disk | Check `DATA_PATH` disk space |

## 📋 Configuration Commands Quick Reference

### Auto-Configuration
```bash
bun run config:auto           # Auto-detect and configure (recommended)
bun run config:wizard         # Interactive configuration wizard
bun run config:auto --force   # Force reconfiguration
bun run config:auto --test    # Test configuration without applying
```

### Configuration Management
```bash
bun run config:show           # Display current configuration and .env values
bun run config:reset          # Reset all configuration to defaults
bun run config:benchmark      # Test system performance only
```

### Quick Setup
```bash
bun run quick-setup           # Auto-config + generate manga library
bun run quick-setup:interactive # Interactive setup + generate library
```

### Monitoring & Health
```bash
bun run health               # Check server health status
bun run stats               # View performance statistics
bun run monitor             # Real-time performance monitoring
bun run benchmark           # Run performance benchmark
```

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
