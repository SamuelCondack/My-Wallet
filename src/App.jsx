import walletIcon from "./assets/walletIcon.png"
import styles from "./App.module.css"
import NewRegister from "./pages/NewRegister/NewRegister"
import { Link } from "react-router-dom"
import { Outlet } from "react-router-dom"

function App() {

  return (
    <>
      <main className={styles.mainContainer}>
        <aside className={styles.asideMenu}>
          <Link to="/" className={styles.iconDiv}><img src={walletIcon} alt="Wallet Icon" className={styles.icon} /><p className={styles.namep}>MyWallet</p></Link>
          <ul className={styles.options}>
            <Link to="/" className={styles.menuLinks}>Despesas</Link>
            <Link to="novoregistro" className={styles.menuLinks}>Novo Registro</Link>
          </ul>
        </aside>
        <Outlet />
      </main>
    </>
  )
}

export default App
