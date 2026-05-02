import React from 'react';

const StatsCard = ({ students }) => {
  const total = students.length;
  const selesai = students.filter(s => s.waktu_selesai).length;
  const aktif = total - selesai;

  // Hitung persentase total pengerjaan kelas
  const avgProgress = total > 0 
    ? Math.round((students.reduce((acc, s) => acc + (s.soal_terjawab || 0), 0) / 
      students.reduce((acc, s) => acc + (s.total_soal || 0), 0)) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {/* Kartu Peserta Aktif */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-blue-500">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mengerjakan</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-blue-600">{aktif}</span>
          <span className="text-xs text-gray-400">Siswa</span>
        </div>
      </div>

      {/* Kartu Selesai */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-green-500">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Sudah Kirim</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-green-600">{selesai}</span>
          <span className="text-xs text-gray-400">Siswa</span>
        </div>
      </div>

      {/* Kartu Total Peserta */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-gray-300">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Peserta</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-gray-800">{total}</span>
          <span className="text-xs text-gray-400">Daftar</span>
        </div>
      </div>

      {/* Kartu Rata-rata Progres Kelas */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-purple-500">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Laju Kelas</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-purple-600">{avgProgress}%</span>
          <span className="text-xs text-gray-400">Selesai</span>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;