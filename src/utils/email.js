import emailjs from '@emailjs/browser';

export const sendApprovalEmail = async (to_email, to_name, role) => {
  try {
    const serviceID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceID || !templateID || !publicKey) {
      console.warn("Konfigurasi EmailJS belum lengkap di .env. Mengabaikan pengiriman email.");
      return true; // Return true agar UI tidak menampilkan error jika akun belum diset.
    }

    const templateParams = {
      to_email: to_email || '',
      to_name: to_name || 'Keluarga',
      role: role ? role.toUpperCase() : 'ANGGOTA',
    };

    const response = await emailjs.send(serviceID, templateID, templateParams, publicKey);
    
    console.log("EmailJS Berhasil:", response.status, response.text);
    return true;
  } catch (err) {
    console.error("Gagal mengirim email via EmailJS:", err);
    return false;
  }
};
