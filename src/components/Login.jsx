import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import logo from '../assets/logo.jpg';

const Login = ({ setSession }) => {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Cek apakah akses proctor diizinkan
            const { data: config } = await supabase
                .from('app_config')
                .select('status')
                .eq('setting_key', 'proctor_access')
                .single();

            if (!config?.status) {
                return Swal.fire({
                    title: 'Akses Ditutup',
                    text: 'Belum diizinkan oleh Admin Pusat.',
                    icon: 'warning',
                    confirmButtonColor: '#15803d'
                });
            }

            // 2. Cari token di tabel pengawas
            const inputToken = token.trim().toUpperCase();
            const { data: pengawas, error } = await supabase
                .from('pengawas')
                .select(`
                    *,
                    jadwal_ujian (
                        *,
                        paket_soal (mapel, jumlah_soal)
                    )
                `)
                .eq('token', inputToken)
                .eq('is_active', true)
                .single();

            if (error || !pengawas) {
                return Swal.fire({
                    title: 'Gagal Masuk',
                    text: 'Token tidak valid atau tidak aktif.',
                    icon: 'error',
                    confirmButtonColor: '#15803d'
                });
            }

            // 3. Pastikan jadwal yang terhubung statusnya aktif
            const jadwal = pengawas.jadwal_ujian;
            if (!jadwal || jadwal.status !== 'aktif') {
                return Swal.fire({
                    title: 'Jadwal Belum Aktif',
                    text: 'Jadwal ujian untuk token ini belum diaktifkan.',
                    icon: 'warning',
                    confirmButtonColor: '#15803d'
                });
            }

            // 4. Update logged_in_at di tabel pengawas
            await supabase
                .from('pengawas')
                .update({ logged_in_at: new Date().toISOString() })
                .eq('id', pengawas.id);

            // 5. Simpan sesi
            const sessionData = {
                token: inputToken,
                kelas: pengawas.nama_kelas,
                mapel: jadwal.paket_soal?.mapel || 'Ujian',
                totalSoal: jadwal.paket_soal?.jumlah_soal || 0,
                jadwalId: pengawas.jadwal_id,
                pengawasId: pengawas.id,
            };

            localStorage.setItem('min2_session', JSON.stringify(sessionData));
            setSession(sessionData);

            Swal.fire({
                title: 'Berhasil!',
                text: `Selamat Mengawas Kelas ${sessionData.kelas}`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#15803d'
            });

        } catch (err) {
            console.error("Login Error:", err);
            Swal.fire({
                title: 'Error',
                text: 'Terjadi gangguan koneksi ke database.',
                icon: 'error',
                confirmButtonColor: '#15803d'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 40%, #166534 100%)' }}>
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #fff 40px, #fff 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fff 40px, #fff 41px)' }} />
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Top green accent strip */}
                    <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #15803d, #4ade80, #15803d)' }} />

                    <div className="px-8 pt-8 pb-10">
                        {/* Logo & Header */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 rounded-full blur-xl opacity-30" style={{ background: '#4ade80' }} />
                                <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 border-green-100" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                                    <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
                                </div>
                            </div>

                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">AONE Smart CBT</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="h-px w-8 bg-green-400" />
                                <p className="text-xs font-bold text-green-700 tracking-[0.2em] uppercase">MIN 2 Sarolangun</p>
                                <div className="h-px w-8 bg-green-400" />
                            </div>

                            <div className="mt-3 px-4 py-1.5 rounded-full text-xs font-semibold text-green-800 bg-green-100 border border-green-200">
                                Portal Pengawas Ujian
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                                    Token Ruangan
                                </label>
                                <div className="relative">
                                    {/* Lock icon */}
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Masukkan Token..."
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        required
                                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl text-center font-black text-xl tracking-[0.3em] uppercase focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-300 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 rounded-2xl font-black text-white text-lg tracking-wide shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                style={{ background: loading ? '#15803d' : 'linear-gradient(135deg, #15803d, #166534)' }}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        MEMVALIDASI...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        MASUK MONITORING
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer note */}
                        <p className="text-center text-xs text-gray-400 mt-6">
                            Gunakan token yang diberikan oleh Admin
                        </p>
                    </div>
                </div>

                {/* Bottom label */}
                <p className="text-center text-green-300 text-xs mt-4 opacity-60">
                    © 2026 AONE Smart CBT • MIN 2 Sarolangun
                </p>
            </div>
        </div>
    );
};

export default Login;