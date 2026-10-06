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
import { useT } from "../../i18n/useT";

const OPEN_DX = 72;
const MAX_DY = 40;
/** Left edge band where iOS swipe-back competes with the menu gesture. */
const EDGE_BACK_PX = 28;

function HomeAuth() {
  const navigate = useNavigate();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const edgeZoneRef = useRef(null);
  const edgeSwipeRef = useRef(null);

  useBodyScrollLock(isMobile && menuOpen);

  const closeMenu = () => setMenuOpen(false);
  const openMenu = () => setMenuOpen(true);

  useEffect(() => {
    if (isMobile && menuOpen) {
      document.documentElement.setAttribute("data-mw-menu-open", "1");
    } else {
      document.documentElement.removeAttribute("data-mw-menu-open");
    }
    return () => {
      document.documentElement.removeAttribute("data-mw-menu-open");
    };
  }, [isMobile, menuOpen]);

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

  /*
   * Block iOS Safari/PWA swipe-back so the left-edge gesture can open the menu.
   * preventDefault must run on touchstart (not only touchmove) — iOS 13.4+.
   * There is no official PWA API to disable the gesture completely.
   */
  useEffect(() => {
    const zone = edgeZoneRef.current;
    if (!zone || !isMobile || menuOpen) return undefined;

    const isInteractive = (target) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "#openMenu, a, button, input, select, textarea, label, [role='button']"
        )
      );
    };

    const onStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      // Cancel the native back-navigation gesture as soon as the finger lands.
      event.preventDefault();
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

    /* Document capture: catch edge touches that miss the zone element. */
    const onDocStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_BACK_PX) return;
      if (isInteractive(event.target)) return;
      event.preventDefault();
    };

    zone.addEventListener("touchstart", onStart, { passive: false });
    zone.addEventListener("touchmove", onMove, { passive: false });
    zone.addEventListener("touchend", onEnd, { passive: true });
    zone.addEventListener("touchcancel", onEnd, { passive: true });
    document.addEventListener("touchstart", onDocStart, {
      passive: false,
      capture: true,
    });

    return () => {
      zone.removeEventListener("touchstart", onStart);
      zone.removeEventListener("touchmove", onMove);
      zone.removeEventListener("touchend", onEnd);
      zone.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("touchstart", onDocStart, { capture: true });
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
          aria-label={t("nav.closeMenu")}
        >
          <img src={x} alt="" aria-hidden="true" />
        </button>
      )}

      <NavLink to="/home/expenses" onClick={handleNavClick} className={styles.iconDiv}>
        <img src={walletIcon} alt={t("nav.walletIconAlt")} className={styles.icon} />
        <p className={styles.namep}>MyWallet</p>
      </NavLink>

      <ul className={styles.options}>
        <NavLink to="/home/expenses" onClick={handleNavClick} className={navClassName}>
          {t("nav.expenses")}
        </NavLink>
        <NavLink to="/home/income" onClick={handleNavClick} className={navClassName}>
          {t("nav.income")}
        </NavLink>
        <NavLink to="/home/dashboard" onClick={handleNavClick} className={navClassName}>
          {t("nav.dashboard")}
        </NavLink>
        <NavLink to="/home/categories" onClick={handleNavClick} className={navClassName}>
          {t("nav.categories")}
        </NavLink>
        <div className={styles.profileSlot}>
          <NavLink
            to="/home/profile"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `${styles.profileIconBtn} ${isActive ? styles.profileIconBtnActive : ""}`
            }
            aria-label={t("nav.profile")}
            title={t("nav.profile")}
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
            aria-label={t("nav.openMenu")}
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
