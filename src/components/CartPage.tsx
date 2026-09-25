import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Trash2, ShieldCheck, ArrowRight, CheckCircle2, CreditCard, Music, Lock } from 'lucide-react';

interface CartPageProps {
  onNavigateCatalog: () => void;
  onOpenTrackDetail: (trackId: string) => void;
  onNavigateProfile: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  onNavigateCatalog,
  onOpenTrackDetail,
  onNavigateProfile,
}) => {
  const { cart, removeFromCart, clearCart, checkoutCart, currentUser } = useApp();

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    buyOrder: string;
    amount: number;
  } | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.track.price, 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;

  const handleStartCheckout = () => {
    setCheckoutModalOpen(true);
  };

  const handleConfirmWebpayPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const result = checkoutCart();
      setIsProcessing(false);
      if (result.success) {
        setPaymentSuccessData({
          buyOrder: result.buyOrder,
          amount: result.amount,
        });
      }
    }, 1500);
  };

  return (
    <div className="py-8 pb-32 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-amber-400" />
            <span>Carrito de Compras</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Revisa tus instrumentales antes de procesar el pago seguro con Webpay Plus
          </p>
        </div>

        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar Carrito</span>
          </button>
        )}
      </div>

      {paymentSuccessData ? (
        /* Success Receipt Screen */
        <div className="bg-[#151722] border border-emerald-500/40 rounded-3xl p-8 sm:p-12 text-center shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
            Transacción Autorizada
          </span>

          <h2 className="text-3xl font-black text-white mt-4 mb-2">
            ¡Pago Realizado con Éxito!
          </h2>
          <p className="text-sm text-zinc-300 max-w-lg mx-auto mb-8">
            Tu compra ha sido procesada correctamente a través de Webpay Plus. Las licencias y archivos WAV ya están habilitados en tu biblioteca personal.
          </p>

          <div className="bg-[#101117] rounded-2xl p-6 max-w-md mx-auto mb-8 border border-zinc-800 text-left space-y-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Orden de Compra:</span>
              <span className="text-amber-400 font-bold">{paymentSuccessData.buyOrder}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Monto Total Pagado:</span>
              <span className="text-white font-bold">
                ${paymentSuccessData.amount.toLocaleString('es-CL')} CLP
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Método de Pago:</span>
              <span className="text-zinc-300">Webpay Plus (Débito/Crédito)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Estado Transbank:</span>
              <span className="text-emerald-400 font-bold">AUTHORIZED (Código 0)</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => {
                setPaymentSuccessData(null);
                onNavigateProfile();
              }}
              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-6 py-3 rounded-xl text-xs transition-colors shadow-lg shadow-amber-400/20"
            >
              Ir a Mis Compras y Descargar
            </button>
            <button
              onClick={() => {
                setPaymentSuccessData(null);
                onNavigateCatalog();
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-6 py-3 rounded-xl text-xs border border-zinc-700 transition-colors"
            >
              Seguir explorando el Catálogo
            </button>
          </div>
        </div>
      ) : cart.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-[#14151e] border border-zinc-800 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Tu carrito está vacío</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto mb-6">
            Aún no has agregado ninguna instrumental. Explora el catálogo y encuentra los mejores beats para tus canciones.
          </p>
          <button
            onClick={onNavigateCatalog}
            className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-6 py-3 rounded-xl text-xs transition-transform hover:scale-105 shadow-md shadow-amber-400/20"
          >
            Explorar Catálogo de Beats
          </button>
        </div>
      ) : (
        /* Items & Summary Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div
                key={item.track.id}
                className="bg-[#151722] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 group hover:border-amber-400/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={item.track.coverUrl}
                    alt={item.track.title}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 cursor-pointer"
                    onClick={() => onOpenTrackDetail(item.track.id)}
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {item.track.genre}
                    </span>
                    <h4
                      onClick={() => onOpenTrackDetail(item.track.id)}
                      className="font-bold text-white text-sm sm:text-base hover:text-amber-400 cursor-pointer truncate mt-1 transition-colors"
                    >
                      {item.track.title}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">
                      Productor: <span className="text-zinc-300 font-semibold">{item.track.producerName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-400 block">
                      ${item.track.price.toLocaleString('es-CL')} CLP
                    </span>
                    <span className="text-[10px] text-zinc-500">Licencia ilimitada</span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.track.id)}
                    className="p-2 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-800"
                    title="Eliminar del carrito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout Breakdown */}
          <div>
            <div className="bg-[#151722] border border-zinc-800 rounded-3xl p-6 sticky top-24 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">Resumen del Pedido</h3>

              <div className="space-y-3 text-xs text-zinc-300 pb-4 border-b border-zinc-800">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Subtotal ({cart.length} productos):</span>
                  <span className="font-semibold text-white">${subtotal.toLocaleString('es-CL')} CLP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">IVA (19%):</span>
                  <span className="font-semibold text-white">${iva.toLocaleString('es-CL')} CLP</span>
                </div>
              </div>

              <div className="pt-4 pb-6 flex justify-between items-baseline">
                <span className="text-sm font-bold text-zinc-300">Total a Pagar:</span>
                <span className="text-2xl font-black text-amber-400">
                  ${total.toLocaleString('es-CL')} CLP
                </span>
              </div>

              <button
                onClick={handleStartCheckout}
                className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-3.5 px-4 rounded-xl text-sm transition-all hover:scale-[1.02] shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
              >
                <span>Proceder al Pago con Webpay</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Transacción cifrada y protegida por Transbank</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webpay Checkout Simulation Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#13141d] border border-zinc-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-xs">
                  TBK
                </div>
                <div>
                  <h4 className="text-sm font-black text-white leading-tight">Webpay Plus</h4>
                  <span className="text-[10px] text-zinc-400">Pasarela Oficial de Pagos</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">
                ${total.toLocaleString('es-CL')} CLP
              </span>
            </div>

            <div className="py-6 space-y-4">
              <div className="bg-[#181a24] p-4 rounded-2xl border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Comercio:</span>
                  <span className="text-zinc-200">BeatsCloud Chile SpA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Orden de Compra:</span>
                  <span className="text-zinc-200">BC-{Math.floor(100000 + Math.random() * 900000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Usuario Comprador:</span>
                  <span className="text-amber-400 font-bold">{currentUser?.username || 'Invitado'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">
                  Simulación de Tarjeta Bancaria:
                </label>
                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span className="font-mono">•••• •••• •••• 4242 (Tarjeta Prepago / Redcompra)</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                disabled={isProcessing}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmWebpayPayment}
                disabled={isProcessing}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isProcessing ? (
                  <span>Autorizando...</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Autorizar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
