import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth } from "../../../config/firebase";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import x from "../../assets/x.svg";
import { useEffect, useState } from "react";
import menu from "../../assets/menu.svg";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { useAuth } from "../../context/AuthContext";

function HomeAuth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useBodyScrollLock(isMobile && menuOpen);

  const closeMenu = () => setMenuOpen(false);
  const openMenu = () => setMenuOpen(true);

  const logout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.log(err.message);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleNavClick = () => {
    if (isMobile) {
      closeMenu();
    }
  };

  if (loading || !user) {
    return <LoadingComponent />;
  }

  const menuContent = (
    <>
      {isMobile && (
        <button
          type="button"
          id="closeMenu"
          onClick={closeMenu}
          className={styles.closeMenu}
          aria-label="Fechar menu"
        >
          <img src={x} alt="" aria-hidden="true" />
        </button>
      )}

      <Link to="expenses" onClick={handleNavClick} className={styles.iconDiv}>
        <img src={walletIcon} alt="Wallet Icon" className={styles.icon} />
        <p className={styles.namep}>MyWallet</p>
      </Link>

      <ul className={styles.options}>
        <Link to="expenses" onClick={handleNavClick} className={styles.menuLinks}>
          Expenses
        </Link>
        <Link to="newregister" onClick={handleNavClick} className={styles.menuLinks}>
          New Register
        </Link>
        <button type="button" onClick={logout} className={styles.logoutBtn}>
          logout
        </button>
      </ul>
    </>
  );

  return (
    <main className={styles.mainContainer}>
      {isMobile && !menuOpen && (
        <button
          type="button"
          id="openMenu"
          onClick={openMenu}
          className={styles.menuButton}
          aria-label="Abrir menu"
        >
          <img src={menu} alt="" className={styles.menuImg} aria-hidden="true" />
        </button>
      )}

      {isMobile && (
        <div
          className={`${styles.backdrop} ${menuOpen ? styles.backdropVisible : ""}`}
          onClick={closeMenu}
          aria-hidden={!menuOpen}
        />
      )}

      <aside
        id="menu"
        className={`${styles.asideMenu} ${isMobile ? styles.asideMenuMobile : ""} ${
          isMobile && menuOpen ? styles.asideMenuOpen : ""
        }`}
        aria-hidden={isMobile && !menuOpen}
      >
        {menuContent}
      </aside>

      <div className={styles.content}>
        <Outlet />
      </div>
    </main>
  );
}

export default HomeAuth;
