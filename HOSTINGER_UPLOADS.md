# Hostinger Uploaded Media Storage

Uploaded images were previously written inside the app folder (`public/uploads` and
`public/customizations`). On Git-based Hostinger deployments, rebuilds or restarts can
replace that folder, while MongoDB Atlas only keeps the saved URL. That causes valid
database records to point at files that no longer exist, which appears as 404 images.

## Required Hostinger Environment Variable

Set this environment variable in Hostinger before uploading new production media:

```text
UPLOAD_STORAGE_DIR=/home/<hostinger-user>/groverygiftz_uploads
```

Use a writable, persistent absolute folder outside the Git deployment/build output
directory. Create the folder in Hostinger File Manager if needed, then restart the app.

`UPLOAD_PUBLIC_BASE_URL` is optional. Leave it empty unless the app must generate media
URLs for a different public hostname.

## What The App Stores

- Admin product, banner, logo, and video uploads are stored under
  `UPLOAD_STORAGE_DIR/uploads`.
- Public admin media is served through `/media/uploads/...`.
- Old `/uploads/...` URLs are still routed for compatibility if the file exists in the
  persistent storage folder.
- Customer customization originals are stored under
  `UPLOAD_STORAGE_DIR/customizations`.
- Customer originals are not public. Admin downloads use the authenticated
  `/api/customization-upload/original-file/...` route.

Files that were already lost from the old app-local `public/uploads` folder cannot be
recovered from MongoDB, because MongoDB stored only the URL metadata, not the file bytes.
Re-upload affected admin banners/images after this deployment and environment setup.
