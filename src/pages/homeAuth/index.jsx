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
import PullToRefresh from "../../components/PullToRefresh/PullToRefresh";

const OPEN_DX = 72;
const MAX_DY = 40;

function HomeAuth() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const edgeZoneRef = useRef(null);
  const edgeSwipeRef = useRef(null);

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

  /* Native non-passive listeners so we can preventDefault and beat iOS back. */
  useEffect(() => {
    const zone = edgeZoneRef.current;
    if (!zone || !isMobile || menuOpen) return undefined;

    const onStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      edgeSwipeRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        active: true,
        opened: false,
      };
    };

    const onMove = (event) => {
      const start = edgeSwipeRef.current;
      if (!start?.active || start.opened) return;
      const touch = event.touches[0];
      if (!touch) return;

      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);

      if (dy > MAX_DY && dy > Math.abs(dx)) {
        start.active = false;
        return;
      }

      if (dx > 10 && dx > dy) {
        event.preventDefault();
      }

      if (dx >= OPEN_DX && dy <= MAX_DY) {
        start.active = false;
        start.opened = true;
        openMenu();
      }
    };

    const onEnd = () => {
      edgeSwipeRef.current = null;
    };

    zone.addEventListener("touchstart", onStart, { passive: true });
    zone.addEventListener("touchmove", onMove, { passive: false });
    zone.addEventListener("touchend", onEnd, { passive: true });
    zone.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      zone.removeEventListener("touchstart", onStart);
      zone.removeEventListener("touchmove", onMove);
      zone.removeEventListener("touchend", onEnd);
      zone.removeEventListener("touchcancel", onEnd);
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
      <PullToRefresh enabled={isMobile && !menuOpen} />
      {isMobile && !menuOpen && (
        <>
          <div
            ref={edgeZoneRef}
            className={styles.edgeSwipeZone}
            aria-hidden="true"
          />
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
