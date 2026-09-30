import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth } from "../../../config/firebase";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import x from "../../assets/x.svg";
import { useEffect, useState } from "react";
import { FaUser } from "react-icons/fa";
import menu from "../../assets/menu.svg";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";

function HomeAuth() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useBodyScrollLock(isMobile && menuOpen);

  const closeMenu = () => setMenuOpen(false);
  const openMenu = () => setMenuOpen(true);

  const requestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    if (isLoggingOut) {
      return;
    }
    setShowLogoutConfirm(false);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      setShowLogoutConfirm(false);
      navigate("/");
    } catch (err) {
      console.log(err.message);
    } finally {
      setIsLoggingOut(false);
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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/signin");
      }
    });

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();
    };
  }, [navigate]);

  const handleNavClick = () => {
    if (isMobile) {
      closeMenu();
    }
  };

  const navClassName = ({ isActive }) =>
    `${styles.menuLinks} ${isActive ? styles.menuLinkActive : ""}`;

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

      <NavLink to="/home/expenses" onClick={handleNavClick} className={styles.iconDiv}>
        <img src={walletIcon} alt="Wallet Icon" className={styles.icon} />
        <p className={styles.namep}>MyWallet</p>
      </NavLink>

      <ul className={styles.options}>
        <NavLink to="/home/expenses" onClick={handleNavClick} className={navClassName}>
          Expenses
        </NavLink>
        <NavLink to="/home/income" onClick={handleNavClick} className={navClassName}>
          Income
        </NavLink>
        <NavLink to="/home/dashboard" onClick={handleNavClick} className={navClassName}>
          Dashboard
        </NavLink>
        <NavLink to="/home/categories" onClick={handleNavClick} className={navClassName}>
          Categories
        </NavLink>
        <div className={styles.profileSlot}>
          <NavLink
            to="/home/profile"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `${styles.profileIconBtn} ${isActive ? styles.profileIconBtnActive : ""}`
            }
            aria-label="Profile"
            title="Profile"
          >
            <FaUser aria-hidden="true" />
          </NavLink>
          <button type="button" onClick={requestLogout} className={styles.logoutBtn}>
            logout
          </button>
        </div>
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

      {showLogoutConfirm && (
        <ConfirmationModal
          isOpen={showLogoutConfirm}
          onRequestClose={cancelLogout}
          onConfirm={confirmLogout}
          title="Log out"
          message="Are you sure you want to log out?"
          isEditModal
          isSubmitting={isLoggingOut}
        />
      )}
    </main>
  );
}

export default HomeAuth;
