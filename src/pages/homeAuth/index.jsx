import walletIcon from "../../assets/WalletIcon.png";
import styles from "./styles.module.scss";
import { auth } from "../../../config/firebase";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import x from "../../assets/x.svg";
import { useEffect, useRef, useState } from "react";
import { FaUser } from "react-icons/fa";
import menu from "../../assets/menu.svg";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const EDGE_ZONE = 28;
const SWIPE_MIN_X = 64;
const SWIPE_MAX_Y = 48;

function HomeAuth() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const swipeRef = useRef(null);

  useBodyScrollLock(isMobile && menuOpen);

  const closeMenu = () => setMenuOpen(false);
  const openMenu = () => setMenuOpen(true);

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

  // Edge swipe (left → right) opens the drawer — app-like PWA feel.
  useEffect(() => {
    if (!isMobile || menuOpen) return undefined;

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_ZONE + (window.visualViewport?.offsetLeft || 0)) {
        swipeRef.current = null;
        return;
      }
      swipeRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        active: true,
      };
    };

    const onTouchMove = (event) => {
      const start = swipeRef.current;
      if (!start?.active) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      if (dy > SWIPE_MAX_Y && dy > Math.abs(dx)) {
        start.active = false;
        return;
      }
      if (dx > SWIPE_MIN_X && dy < SWIPE_MAX_Y) {
        start.active = false;
        openMenu();
      }
    };

    const onTouchEnd = () => {
      swipeRef.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isMobile, menuOpen]);

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
        </div>
      </ul>
    </>
  );

  return (
    <main className={styles.mainContainer}>
      {isMobile && !menuOpen && (
        <>
          <div className={styles.edgeSwipeZone} aria-hidden="true" />
          <button
            type="button"
            id="openMenu"
            onClick={openMenu}
            className={styles.menuButton}
            aria-label="Abrir menu"
          >
            <img src={menu} alt="" className={styles.menuImg} aria-hidden="true" />
          </button>
        </>
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
