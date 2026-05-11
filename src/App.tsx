import * as React from "react";
import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from "react";
import { 
  Coins, 
  History, 
  ChevronRight, 
  User, 
  LogOut, 
  QrCode, 
  MessageCircle, 
  CheckCircle2, 
  X,
  CreditCard,
  Smartphone,
  XCircle,
  Search,
  MoreVertical,
  AlertCircle,
  Send,
  Loader2,
  Image as ImageIcon,
  Layout,
  Maximize2,
  Check,
  Clock,
  Share2,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { 
  auth, 
  db, 
  loginAnonymously, 
  logout, 
  handleFirestoreError, 
  OperationType,
  requestNotificationPermission,
  messaging
} from "./firebase";
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  addDoc,
  getDoc,
  getDocFromServer,
  getDocs
} from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              {this.state.error?.message.startsWith('{') 
                ? "A database error occurred. Please try again later."
                : this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#fe2c55] text-white rounded-xl font-bold"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Package {
  coins: number;
  price: number;
  label?: string;
  discount?: string;
}

const COIN_PACKAGES: Package[] = [
  { coins: 30, price: 8550 },
  { coins: 350, price: 99750 },
  { coins: 700, price: 199500 },
  { coins: 1400, price: 399000 },
  { coins: 3500, price: 997500 },
  { coins: 7000, price: 1995000 },
  { coins: 17500, price: 4987500 },
];

// Bank configuration (Admin should edit this)
const BANK_CONFIG = {
  bankId: "vcb", // Vietcombank
  accountNumber: "0411001086628",
  accountName: "NGO VAN KIEN",
  zaloNumber: "0358247870",
  zaloLink: "https://zalo.me/0358247870",
};

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [tiktokId, setTiktokId] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState("");
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showZaloModal, setShowZaloModal] = useState(false);
  const [customCoins, setCustomCoins] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showPaymentModal && countdown > 0 && !isCheckingPayment) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowPaymentModal(false);
    }
    return () => clearInterval(timer);
  }, [showPaymentModal, countdown, isCheckingPayment]);

  // Real-time Transaction Notifications
  useEffect(() => {
    if (!user) return;

    // 3. Real-time Firestore Listener for Transaction Status Changes
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data();
          
          if (data.status === "completed") {
            toast.success("Thanh toán thành công!", {
              description: `Bạn đã nhận được ${data.coins.toLocaleString()} xu.`,
              duration: 5000,
            });
            if (change.doc.id === currentTransactionId) {
              setShowPaymentModal(false);
              setShowConfirmModal(false);
              setCurrentTransactionId(null);
            }
          } else if (data.status === "failed") {
            toast.error("Thanh toán thất bại", {
              description: "Vui lòng kiểm tra lại giao dịch hoặc liên hệ hỗ trợ.",
              duration: 5000,
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, currentTransactionId]);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        // Check for local ID fallback
        const localId = localStorage.getItem('tiktok_recharge_local_id');
        if (localId) {
          setUser({ uid: localId, isAnonymous: true } as any);
        } else {
          setUser(null);
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setTiktokId(null);
      setBalance(0);
      setHistory([]);
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTiktokId(data.tiktokId);
        setBalance(data.balance || 0);
        setReferralCode(data.referralCode || null);
      } else {
        // New user, need to set TikTok ID
        setShowLoginModal(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    const transactionsQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubHistory = onSnapshot(transactionsQuery, (querySnapshot) => {
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().createdAt?.toDate()?.getTime() || Date.now()
      }));
      setHistory(historyData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "transactions");
    });

    return () => {
      unsubUser();
      unsubHistory();
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleLogin = async () => {
    if (!loginInput.trim()) {
      toast.error("Lỗi đăng nhập", { description: "Vui lòng nhập TikTok ID hợp lệ." });
      return;
    }

    try {
      let currentUser = user;
      if (!currentUser) {
        const result = await loginAnonymously();
        currentUser = result.user as any;
        setUser(currentUser);
      }

      if (loginInput.trim() && currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (!docSnap.exists()) {
          const urlParams = new URLSearchParams(window.location.search);
          const referredBy = urlParams.get('ref') || null;
          
          await setDoc(userDocRef, {
            tiktokId: loginInput,
            balance: 0,
            referralCode: generateReferralCode(),
            referredBy: referredBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          const userData = docSnap.data();
          if (!userData.referralCode) {
            await updateDoc(userDocRef, {
              tiktokId: loginInput,
              referralCode: generateReferralCode(),
              updatedAt: serverTimestamp()
            });
          } else {
            await updateDoc(userDocRef, {
              tiktokId: loginInput,
              updatedAt: serverTimestamp()
            });
          }
        }
        setShowLoginModal(false);
        setLoginInput("");
        toast.success("Đăng nhập thành công!");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Đã xảy ra lỗi khi đăng nhập", {
        description: "Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."
      });
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          balance: 0,
          updatedAt: serverTimestamp()
        });
      }
      await logout();
      localStorage.removeItem('tiktok_recharge_local_id');
      setUser(null);
      setShowProfileMenu(false);
      toast.success("Đã đăng xuất", { description: "Lịch sử đã được lưu và số dư đã được reset." });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleRecharge = () => {
    if (!tiktokId) {
      setShowLoginModal(true);
      return;
    }
    if (isCustom) {
      const c = parseInt(customCoins);
      if (isNaN(c) || c < 30) return;
      setSelectedPackage({ coins: c, price: getCustomPrice(c) });
    } else if (!selectedPackage) {
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmRecharge = () => {
    setShowConfirmModal(false);
    setCountdown(300);
    setIsCheckingPayment(false);
    setShowPaymentModal(true);
  };

  const getCustomPrice = (coins: number) => {
    return coins * getRate(coins);
  };

  const getRate = (coins: number) => {
    if (coins <= 20000) return 285;
    if (coins <= 50000) return 284;
    if (coins <= 100000) return 283.5;
    if (coins <= 200000) return 283;
    if (coins <= 500000) return 282;
    if (coins <= 1000000) return 281;
    return 280;
  };

  const handleBuy = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    
    // Get coins and price based on selection
    const coins = isCustom ? parseInt(customCoins) : selectedPackage?.coins || 0;
    const price = isCustom ? getCustomPrice(coins) : selectedPackage?.price || 0;
    
    if (coins <= 0) return;
    
    try {
      setIsCheckingPayment(true);
      
      // 1. Create transaction record (Initially pending)
      const transactionRef = await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        coins: coins,
        price: price,
        status: "pending",
        createdAt: serverTimestamp()
      });

      setCurrentTransactionId(transactionRef.id);

      // Simulate a delay for checking payment
      setTimeout(async () => {
        try {
          // 2. Update user balance
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            balance: balance + coins,
            updatedAt: serverTimestamp()
          });

          // 3. Update transaction status to 'completed' after successful payment confirmation
          await updateDoc(transactionRef, {
            status: "completed",
            completedAt: serverTimestamp()
          });

          // 4. Referral Bonus Logic (10% bonus to referrer)
          const currentUserDoc = await getDoc(userDocRef);
          const currentUserData = currentUserDoc.data();
          if (currentUserData?.referredBy) {
            const q = query(collection(db, "users"), where("referralCode", "==", currentUserData.referredBy));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const referrerDoc = querySnapshot.docs[0];
              const referrerData = referrerDoc.data();
              const bonusCoins = Math.floor(coins * 0.1); 
              
              if (bonusCoins > 0) {
                await updateDoc(referrerDoc.ref, {
                  balance: (referrerData.balance || 0) + bonusCoins,
                  updatedAt: serverTimestamp()
                });
                
                // Add bonus transaction record
                await addDoc(collection(db, "transactions"), {
                  userId: referrerDoc.id,
                  coins: bonusCoins,
                  price: 0,
                  status: "completed",
                  type: "referral_bonus",
                  referredUserId: user.uid,
                  createdAt: serverTimestamp(),
                  completedAt: serverTimestamp()
                });
              }
            }
          }

          setIsCheckingPayment(false);
          setShowPaymentModal(false);
          setShowZaloModal(true);
        } catch (error) {
          console.error("Error confirming payment:", error);
          setIsCheckingPayment(false);
          toast.error("Lỗi xác nhận thanh toán", {
            description: "Hệ thống đang bận, vui lòng thử lại sau hoặc liên hệ CSKH."
          });
        }
      }, 3000); // 3 seconds delay

    } catch (error) {
      setIsCheckingPayment(false);
      toast.error("Lỗi tạo giao dịch", {
        description: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng."
      });
      handleFirestoreError(error, OperationType.WRITE, "transactions");
    }
  };

  const formatPrice = (price: number) => {
    return "đ" + new Intl.NumberFormat("vi-VN").format(price);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] font-sans">
      {/* TikTok Header */}
      <header className="h-[60px] bg-white border-b border-gray-200 px-3 md:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 shrink-0">
          <img 
            src="https://sf16-scmcdn-va.ibytedtos.com/goofy/tiktok/web/node/_next/static/images/logo-dark-e95da587b6de167aaed06c9da23175f3.svg" 
            alt="TikTok Logo" 
            className="h-8 w-auto"
            referrerPolicy="no-referrer"
          />
          <span className="font-black text-xl tracking-tight text-[#161823]">/coins-pita</span>
        </div>

        <div className="hidden lg:flex flex-1 max-w-[500px] mx-4 relative group">
          <input 
            type="text" 
            placeholder="Search" 
            className="w-full bg-[#f1f1f2] rounded-full py-2 px-4 pr-16 focus:outline-none border border-transparent focus:border-gray-300 transition-all text-sm"
          />
          <button className="absolute right-0 top-0 bottom-0 w-12 border-l border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-200 rounded-r-full transition-colors">
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              <button 
                onClick={handleLogout}
                className="hidden sm:block text-[14px] font-bold text-[#161823] hover:bg-gray-100 px-3 py-1.5 rounded transition-colors"
              >
                Log out
              </button>
              <div className="relative">
                <div 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                
                <AnimatePresence>
                  {showProfileMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowProfileMenu(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-20"
                      >
                        <div className="px-4 py-2 border-b border-gray-50">
                          <div className="font-bold text-sm truncate">{tiktokId || "User"}</div>
                          <div className="text-[10px] text-gray-400">{tiktokId ? "TikTok ID" : "Guest"}</div>
                        </div>
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowLoginModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <User className="w-4 h-4" />
                          {tiktokId ? "Change TikTok ID" : "Set TikTok ID"}
                        </button>
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowHistoryModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <History className="w-4 h-4" />
                          Transaction history
                        </button>
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowReferralModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-[#fe2c55]"
                        >
                          <Share2 className="w-4 h-4" />
                          Chia sẻ & Nhận thưởng
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="bg-[#fe2c55] text-white px-6 py-1.5 rounded font-bold text-[15px] hover:bg-[#e0244a] transition-colors"
            >
              Log in
            </button>
          )}
          <MoreVertical className="w-6 h-6 text-[#161823] cursor-pointer" />
        </div>
      </header>

      <div className="w-full md:max-w-4xl mx-auto md:mt-6 bg-white md:rounded-xl shadow-sm overflow-hidden p-4 sm:p-6 md:p-10">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#161823]">Get Coins</h1>

        {/* User Section */}
        <div className="mb-6 md:mb-8">
          {user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#f1f1f2] rounded-lg p-3 md:px-4 md:py-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[#161823] leading-tight truncate">{tiktokId || "Set TikTok ID"}</div>
                  <div className="text-[11px] md:text-[12px] text-[#face15] font-bold">{balance.toLocaleString()} coins</div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="text-[13px] md:text-[14px] font-bold text-[#fe2c55] hover:underline whitespace-nowrap"
                >
                  {tiktokId ? "Switch" : "Set ID"}
                </button>
                <span className="text-gray-300 shrink-0">|</span>
                <button 
                  onClick={() => setShowHistoryModal(true)}
                  className="text-[13px] md:text-[14px] font-bold text-[#161823] hover:underline whitespace-nowrap"
                >
                  History
                </button>
                <span className="text-gray-300 shrink-0">|</span>
                <button 
                  onClick={handleLogout}
                  className="text-[13px] md:text-[14px] font-bold text-gray-500 hover:underline whitespace-nowrap"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShowLoginModal(true)}
              className="bg-[#f1f1f2] flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors w-full sm:w-auto sm:inline-flex"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
              </div>
              <span className="font-bold text-[#161823] text-base md:text-lg">Log In with TikTok ID</span>
            </div>
          )}
        </div>

        {/* Recharge Info */}
        <div className="mb-4 md:mb-6 flex items-start sm:items-center gap-1.5 text-xs md:text-sm font-bold">
          <span className="text-[#161823] shrink-0">Recharge:</span>
          <span className="text-[#fe2c55]">Save around 25% with a lower third-party service fee.</span>
          <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[10px] text-gray-400 cursor-help shrink-0 mt-0.5 sm:mt-0">i</div>
        </div>

        {/* Coin Packages Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 mb-6 md:mb-8">
          {COIN_PACKAGES.map((pkg, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedPackage(pkg);
                setIsCustom(false);
              }}
              className={`relative p-4 rounded-lg text-center transition-all border ${
                selectedPackage?.coins === pkg.coins && !isCustom
                  ? 'border-[#fe2c55] bg-white'
                  : 'border-transparent bg-[#f1f1f2] hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-5 h-5 bg-[#face15] rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">d</span>
                </div>
                <span className="font-bold text-lg text-[#161823]">{pkg.coins.toLocaleString()}</span>
              </div>
              <div className="text-[#73757d] text-sm underline decoration-gray-400 underline-offset-4 mb-1">
                {formatPrice(pkg.price)}
              </div>
              {pkg.discount && (
                <div className="text-[10px] font-bold text-[#fe2c55] bg-[#fe2c55]/10 rounded px-1.5 py-0.5 inline-block">
                  {pkg.discount}
                </div>
              )}
            </button>
          ))}

          {/* Custom Package - Direct Input */}
          <div
            onClick={() => {
              setIsCustom(true);
              setSelectedPackage(null);
              setTimeout(() => customInputRef.current?.focus(), 0);
            }}
            className={`relative p-3 md:p-4 rounded-lg transition-all border flex flex-col justify-center min-h-[100px] md:min-h-[120px] ${
              isCustom
                ? 'border-[#fe2c55] bg-[#fff0f3] ring-2 ring-[#fe2c55]/10'
                : 'border-transparent bg-[#f1f1f2] hover:bg-gray-200 cursor-pointer'
            }`}
          >
            {!isCustom ? (
              <div className="text-center">
                <div className="font-bold text-base md:text-lg text-[#161823]">Custom</div>
                <div className="text-[#73757d] text-[9px] md:text-[10px] mt-1">Up to 2.5M coins</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1.5 md:mb-2">
                  <span className="text-[9px] md:text-[10px] font-bold text-[#fe2c55] uppercase tracking-wider">Custom Amount</span>
                  {parseInt(customCoins) > 1000000 && (
                    <span className="text-[8px] md:text-[9px] bg-[#fe2c55] text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">BEST VALUE</span>
                  )}
                </div>
                <div className="flex items-end gap-1.5 md:gap-2">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-[#face15] rounded-full flex items-center justify-center shrink-0 mb-1">
                    <span className="text-[9px] md:text-[10px] font-bold text-white">d</span>
                  </div>
                  <div className="flex-1 border-b-2 border-[#fe2c55]">
                    <input 
                      ref={customInputRef}
                      type="number"
                      value={customCoins}
                      onChange={(e) => {
                        setIsCustom(true);
                        setSelectedPackage(null);
                        const val = parseInt(e.target.value);
                        if (val > 2500000) {
                          setCustomCoins("2500000");
                        } else {
                          setCustomCoins(e.target.value);
                        }
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-xl md:text-2xl font-black p-0 pb-1 text-[#161823]"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                {/* Custom Price Display with Tier Info */}
                {(customCoins === "" || parseInt(customCoins) < 30) ? (
                  <div className="flex items-center gap-1.5 text-[#fe2c55] font-bold text-[9px] md:text-[10px] mt-2 md:mt-3">
                    <div className="w-3 h-3 md:w-3.5 md:h-3.5 bg-[#fe2c55] rounded-full flex items-center justify-center">
                      <X className="w-2 md:w-2.5 h-2 md:h-2.5 text-white stroke-[4]" />
                    </div>
                    <span>Min: 30 coins</span>
                  </div>
                ) : (
                  <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-[#fe2c55]/10">
                    <div className="flex justify-between items-end">
                      <div className="text-xs md:text-sm font-black text-[#fe2c55]">
                        {formatPrice(getCustomPrice(parseInt(customCoins)))}
                      </div>
                      <div className="text-[9px] md:text-[10px] font-bold text-gray-400">
                        {getRate(parseInt(customCoins))}đ/xu
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Total and Recharge Button */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-bold text-[#161823]">Total</span>
            <span className="font-bold text-[#161823]">
              {isCustom && customCoins && parseInt(customCoins) >= 30 
                ? formatPrice(getCustomPrice(parseInt(customCoins))) 
                : selectedPackage && !isCustom 
                  ? formatPrice(selectedPackage.price) 
                  : "đ0"}
            </span>
          </div>

          <button 
            disabled={(!selectedPackage && !isCustom) || (isCustom && (!customCoins || parseInt(customCoins) < 30))}
            onClick={handleRecharge}
            className="w-full md:w-64 py-3 bg-[#fe2c55] text-white rounded-md font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Recharge
          </button>
        </div>

        {/* Secure Payment Badge */}
        <div className="flex justify-end">
          <div className="flex items-center gap-1 border border-[#7ed321] rounded px-2 py-0.5 text-[#7ed321] text-[10px] font-bold uppercase">
            <div className="w-3 h-3 bg-[#7ed321] rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-2 h-2 text-white" />
            </div>
            SECURE Payment
          </div>
        </div>
      </div>

      {/* Footer Invite Section */}
      <div className="w-full md:max-w-4xl mx-auto md:mt-4 bg-white md:rounded-xl shadow-sm p-4 md:p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-2xl md:text-3xl">👏</div>
          <div>
            <div className="font-bold text-sm md:text-base text-[#161823]">Invite & Get Rewards</div>
            <div className="text-xs md:text-sm text-gray-500">Check out this new feature!</div>
          </div>
        </div>
        <ChevronRight className="text-gray-300 w-5 h-5 md:w-6 md:h-6" />
      </div>

      {/* History Button (Floating) */}
      <button 
        onClick={() => setShowHistoryModal(true)}
        className="fixed bottom-6 right-6 bg-white shadow-lg p-4 rounded-full border border-gray-100 hover:bg-gray-50 transition-all z-30"
      >
        <History className="w-6 h-6 text-[#fe2c55]" />
      </button>

      {/* Referral Modal */}
      <AnimatePresence>
        {showReferralModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReferralModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-5 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xl md:text-2xl font-black">Chia sẻ & Nhận thưởng</h4>
                  <button onClick={() => setShowReferralModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-pink-100 text-[#fe2c55] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Share2 className="w-8 h-8" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Nhận ngay <span className="text-[#fe2c55] font-bold">10% xu thưởng</span> cho mỗi giao dịch nạp xu từ bạn bè được giới thiệu!
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Mã giới thiệu của bạn</p>
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                    <span className="font-mono text-lg font-bold text-[#161823]">{referralCode || "Đang tải..."}</span>
                    <button 
                      onClick={() => {
                        if (referralCode) {
                          navigator.clipboard.writeText(referralCode);
                          toast.success("Đã sao chép mã giới thiệu!");
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-[#fe2c55] hover:bg-pink-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Link chia sẻ</p>
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-600 truncate mr-2">
                      {`${window.location.origin}?ref=${referralCode}`}
                    </span>
                    <button 
                      onClick={() => {
                        if (referralCode) {
                          navigator.clipboard.writeText(`${window.location.origin}?ref=${referralCode}`);
                          toast.success("Đã sao chép link chia sẻ!");
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-[#fe2c55] hover:bg-pink-50 rounded-lg transition-colors shrink-0"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowReferralModal(false)}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-2xl p-5 md:p-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-xl md:text-2xl font-black">Lịch sử nạp xu</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
                {!tiktokId ? (
                  <div className="text-center py-10 text-gray-500">
                    Vui lòng đăng nhập để xem lịch sử
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    Chưa có giao dịch nào
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <div className="font-black text-base md:text-lg text-[#face15]">+{item.coins.toLocaleString()} xu</div>
                          <div className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-[#fe2c55] font-black text-sm md:text-base">{formatPrice(item.price)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 md:p-10 shadow-2xl"
            >
              <button onClick={() => setShowLoginModal(false)} className="absolute right-4 top-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <h2 className="text-xl md:text-2xl font-black mb-6 text-center text-[#161823]">
                {tiktokId ? "Change your TikTok ID" : "Log in with TikTok ID"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">TikTok ID</label>
                  <input 
                    type="text"
                    placeholder="@username"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-[#fe2c55] focus:bg-white focus:ring-0 transition-all text-[#161823] font-bold"
                  />
                </div>
                <button 
                  onClick={handleLogin}
                  disabled={!loginInput.trim()}
                  className="w-full py-4 bg-[#fe2c55] text-white rounded-xl font-black text-lg shadow-lg shadow-pink-100 hover:opacity-90 transition-all disabled:opacity-30"
                >
                  {tiktokId ? "Update TikTok ID" : "Log In Now"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 md:p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-black">Xác nhận nạp xu</h2>
                <button onClick={() => setShowConfirmModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
              
              <p className="text-gray-500 mb-6 font-medium text-sm md:text-base">Vui lòng kiểm tra lại thông tin gói nạp của bạn:</p>
              
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6 mb-8 space-y-4 border border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Tài khoản</span>
                  <span className="font-black text-[#161823] text-sm md:text-base truncate max-w-[150px]">{tiktokId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Số lượng xu</span>
                  <span className="font-black flex items-center gap-2 text-sm md:text-base text-[#face15]">
                    <div className="w-4 h-4 md:w-5 md:h-5 bg-[#face15] rounded-full flex items-center justify-center">
                      <span className="text-[8px] md:text-[10px] font-bold text-white">d</span>
                    </div>
                    {(isCustom ? parseInt(customCoins) : selectedPackage?.coins || 0).toLocaleString()} xu
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg md:text-xl border-t border-gray-200 pt-4 mt-4">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Tổng thanh toán</span>
                  <span className="font-black text-[#fe2c55]">
                    {formatPrice(isCustom ? getCustomPrice(parseInt(customCoins)) : selectedPackage?.price || 0)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 md:gap-4">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3.5 md:py-4 rounded-xl font-bold border-2 border-gray-100 hover:bg-gray-50 transition-all text-gray-500 text-sm md:text-base"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmRecharge}
                  className="flex-1 py-3.5 md:py-4 rounded-xl font-bold bg-[#fe2c55] text-white hover:bg-[#e0244a] shadow-lg shadow-pink-100 transition-all text-sm md:text-base"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (selectedPackage || isCustom) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col"
            >
              <div className="p-5 md:p-8 overflow-y-auto scrollbar-hide">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h4 className="text-xl md:text-2xl font-black">Thanh toán</h4>
                  <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="bg-gray-50 p-4 md:p-6 rounded-xl mb-6 md:mb-8 flex justify-between items-center border border-gray-100">
                  <div>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Gói đã chọn</p>
                    <p className="text-xl md:text-2xl font-black text-[#face15]">{(isCustom ? parseInt(customCoins) : selectedPackage?.coins || 0).toLocaleString()} xu</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Tổng tiền</p>
                    <p className="text-xl md:text-2xl font-black text-[#fe2c55]">
                      {formatPrice(isCustom ? getCustomPrice(parseInt(customCoins)) : selectedPackage?.price || 0)}
                    </p>
                  </div>
                </div>

                <div className="text-center mb-6 md:mb-8">
                  {isCheckingPayment ? (
                    <div className="py-12 flex flex-col items-center justify-center">
                      <Loader2 className="w-12 h-12 text-[#fe2c55] animate-spin mb-4" />
                      <p className="text-lg font-bold text-gray-800">Đang kiểm tra giao dịch...</p>
                      <p className="text-sm text-gray-500 mt-2">Vui lòng không đóng cửa sổ này</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center justify-center mb-6">
                        <p className="text-gray-500 font-medium text-sm md:text-base mb-3">Quét mã VietQR để chuyển khoản</p>
                        <div className={`bg-red-50 text-[#fe2c55] px-4 py-2 rounded-full text-base md:text-lg font-black flex items-center gap-2 border border-red-100 ${countdown < 60 ? 'animate-pulse bg-red-100' : ''}`}>
                          <Clock className="w-5 h-5" />
                          Thời gian còn lại: {formatTime(countdown)}
                        </div>
                      </div>
                      <div className="bg-white p-3 md:p-4 border-2 border-gray-100 rounded-2xl inline-block shadow-inner relative">
                        <img 
                          src={`https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNumber}-compact2.png?amount=${isCustom ? getCustomPrice(parseInt(customCoins)) : selectedPackage?.price || 0}&addInfo=NAP%20XU%20${tiktokId}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`}
                          alt="VietQR"
                          className="w-48 h-48 md:w-64 md:h-64 object-contain"
                        />
                        {/* Progress bar for countdown */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-100 rounded-b-2xl overflow-hidden">
                          <div 
                            className="h-full bg-[#fe2c55] transition-all duration-1000 ease-linear"
                            style={{ width: `${(countdown / 300) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 p-3 md:p-4 bg-yellow-50 rounded-xl text-yellow-800 text-xs md:text-sm font-bold border border-yellow-100">
                        Nội dung: <span className="font-black">NAP XU {tiktokId}</span>
                      </div>
                    </>
                  )}
                </div>

                {!isCheckingPayment && (
                  <button 
                    onClick={handleBuy}
                    className="w-full py-4 md:py-5 bg-[#fe2c55] text-white rounded-xl font-black text-lg md:text-xl shadow-lg shadow-pink-200 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    Đã chuyển khoản
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zalo Modal */}
      <AnimatePresence>
        {showZaloModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowZaloModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 md:p-8 text-center shadow-2xl"
            >
              <div className="bg-blue-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
              </div>
              <h4 className="text-xl md:text-2xl font-black mb-2">Xác nhận giao dịch</h4>
              <p className="text-gray-500 mb-4 leading-relaxed text-sm md:text-base">
                Vui lòng liên hệ Zalo <span className="font-bold text-black">{BANK_CONFIG.zaloNumber}</span> để được duyệt xu ngay lập tức.
              </p>

              <div className="mb-6 bg-white p-3 border-2 border-blue-100 rounded-2xl inline-block shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(BANK_CONFIG.zaloLink)}`}
                  alt="Zalo QR Code"
                  className="w-40 h-40 md:w-48 md:h-48 object-contain"
                  referrerPolicy="no-referrer"
                />
                <p className="mt-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest">Quét mã Zalo</p>
              </div>
              
              <div className="space-y-3">
                <a 
                  href={BANK_CONFIG.zaloLink} 
                  target="_blank"
                  className="block w-full py-3.5 md:py-4 bg-blue-500 text-white rounded-xl font-bold text-base md:text-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-5 h-5" />
                  Mở Zalo App
                </a>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(BANK_CONFIG.zaloNumber);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`w-full py-3.5 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all flex items-center justify-center gap-2 ${
                    copied 
                      ? "bg-green-500 text-white" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Đã copy!
                    </>
                  ) : (
                    "Copy số Zalo"
                  )}
                </button>
                <button 
                  onClick={() => setShowZaloModal(false)}
                  className="w-full py-3 md:py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors text-sm md:text-base"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Zalo Button */}
      <motion.a
        href={BANK_CONFIG.zaloLink}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-40 bg-blue-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center group"
      >
        <div className="absolute right-full mr-3 bg-white text-blue-500 px-3 py-1.5 rounded-lg shadow-lg text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-blue-100">
          Hỗ trợ Zalo 24/7
        </div>
        <MessageCircle className="w-6 h-6 md:w-7 md:h-7" />
      </motion.a>
    </div>
  );
}
