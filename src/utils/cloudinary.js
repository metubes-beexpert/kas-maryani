import imageCompression from 'browser-image-compression';

export async function uploadImageToCloudinary(file, customFileName) {
  if (!file) return null;

  // Kompresi Opsi (Maksimal ~500kb, mengonversi ke webp/jpg efisien)
  const options = {
    maxSizeMB: 0.5, 
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    // Siapkan Form Data untuk Cloudinary
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_PRESET || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
    
    // Terapkan folder dan custom public_id sesuai instruksi
    formData.append('folder', 'transaction');
    if (customFileName) {
       formData.append('public_id', customFileName);
    }
    
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.secure_url; // URL asli gambar di cloud

  } catch (err) {
    console.error("Gagal mengupload gambar:", err);
    throw err;
  }
}
