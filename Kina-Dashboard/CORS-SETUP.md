# CORS Configuration for Kina Resort Dashboard

## Overview

The CORS (Cross-Origin Resource Sharing) configuration has been enhanced to provide better security while maintaining flexibility for development and production environments.

## Current Configuration

### Development Environment
- **Origin**: `*` (all origins allowed)
- **Credentials**: Enabled
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With

### Production Environment
- **Origin**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Credentials**: Enabled
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With

## Configuration in .env

Add the following to your `.env` file for production:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

For development, you can leave `ALLOWED_ORIGINS` commented out or unset to allow all origins.

## Testing CORS

### Check CORS Headers

You can verify CORS is working by checking response headers:

```bash
# Using curl
curl -I http://localhost:3000/api/bookings

# Using PowerShell
Invoke-WebRequest -Uri http://localhost:3000/api/bookings -Method OPTIONS
```

### Expected Headers

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
```

## Port Information

### Default Port
- **Development**: 3000 (configurable via PORT in .env)
- **Production**: 3000 (or any port assigned by hosting provider)

### Alternative Ports

If port 3000 is in use, you can change it in `.env`:

```env
PORT=3001
```

Or any other available port like 3002, 5000, 8000, etc.

### Check Port Availability

**Windows (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

**Linux/Mac:**
```bash
lsof -i :3000
```

### Kill Process on Port (Windows)

```powershell
# Find process ID
$process = Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess

# Kill the process
Stop-Process -Id $process -Force
```

### Kill Process on Port (Linux/Mac)

```bash
# Find and kill in one command
lsof -ti:3000 | xargs kill -9
```

## Server Host Configuration

The server listens on `0.0.0.0` by default, which means it accepts connections from all network interfaces.

You can change this in `.env`:

```env
SERVER_HOST=127.0.0.1  # Localhost only
SERVER_HOST=0.0.0.0    # All interfaces (default)
```

## Common Port Issues

### EADDRINUSE Error

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. **Kill existing process** (see commands above)
2. **Change port** in `.env`:
   ```env
   PORT=3001
   ```
3. **Find and stop Node processes**:
   ```powershell
   Get-Process -Name node | Stop-Process -Force
   ```

## Browser Testing

For production CORS testing, you can test from browser console:

```javascript
// Test API endpoint
fetch('https://your-api-domain.com/api/bookings', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('CORS error:', error));
```

## Security Best Practices

1. **Always specify origins in production** - Never use `*` in production
2. **Use HTTPS** - Enable SSL/TLS certificates
3. **Limit methods** - Only allow necessary HTTP methods
4. **Validate headers** - Only accept known, safe headers
5. **Monitor requests** - Check CORS-related errors in logs

## Troubleshooting

### CORS Errors in Browser

**Error:** `Access to fetch has been blocked by CORS policy`

**Checklist:**
- ✅ Verify `NODE_ENV` is set correctly
- ✅ Check `ALLOWED_ORIGINS` includes your domain
- ✅ Ensure credentials are handled correctly
- ✅ Verify server is sending proper CORS headers

### Preflight Request Fails

**Error:** OPTIONS request returns 404 or fails

**Solution:** The CORS middleware should handle OPTIONS requests automatically. Verify it's configured before other routes.

### Credentials Not Working

**Error:** Cookies/sessions not persisting

**Solution:** Ensure both server and client set `credentials: 'include'` in fetch requests and `credentials: true` in CORS config.

## Files Modified

- `server.js` - Enhanced CORS configuration
- `env.example.txt` - Added CORS documentation
- `CORS-SETUP.md` - This documentation file

## Additional Resources

- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://github.com/expressjs/cors)
- [Supabase CORS Configuration](https://supabase.com/docs/guides/auth/cors)

