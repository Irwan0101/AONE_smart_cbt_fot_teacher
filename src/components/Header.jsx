import React from 'react';

const Header = ({ session, onLogout }) => {
  return (
    <header className="bg-green-800 text-white p-4 sticky top-0 z-50 shadow-xl">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Logo Kemenag Putih/BG Putih Bulat */}
          <div className="bg-white p-1 rounded-full shadow-md">
            <img 
              src="https://tse1.mm.bing.net/th/id/OIP.Y6GOZlqmwmNmzzKmc5Y2hwHaGv?rs=1&pid=ImgDetMain&o=7&rm=3" 
              alt="Logo Kemenag" 
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h1 className="font-black text-sm lg:text-lg tracking-tight leading-none">
              MIN 2 SAROLANGUN
            </h1>
            <p className="text-[10px] lg:text-xs font-medium opacity-80 uppercase tracking-widest mt-1">
              {session.mapel} • KELAS {session.kelas}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right mr-2">
            <p className="text-[9px] opacity-60 uppercase font-bold">Token Ruang</p>
            <p className="text-sm font-mono font-bold tracking-tighter">{session.token}</p>
          </div>
          <button 
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95 uppercase"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;