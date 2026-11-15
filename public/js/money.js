(function (global) {
  function formatRupiah(amountInRibuan) {
    const num = Number(amountInRibuan) || 0;
    const rupiah = Math.round(num * 1000);
    if (rupiah === 0) return 'Rp0';

    const sign = rupiah < 0 ? '-' : '';
    const abs = Math.abs(rupiah);

    if (abs < 10000) {
      return `${sign}Rp${abs}`;
    }
    if (abs < 1000000) {
      return `${sign}Rp${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    }

    const jt = Math.round((abs / 1000000) * 1000) / 1000;
    const [intPart, decPart] = String(jt).split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${sign}Rp ${formattedInt},${decPart}jt` : `${sign}Rp ${formattedInt}jt`;
  }

  global.formatRupiah = formatRupiah;
})(typeof window !== 'undefined' ? window : globalThis);
