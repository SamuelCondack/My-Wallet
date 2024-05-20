import styles from "./Expenses.module.scss"

export default function Expenses({ location }) {
    const newRegisterData = location.state.newRegisterData;

    return (
        <div>
            <h2>Expenses</h2>
            <div>
                <p>Name {newRegisterData.name}</p>
            </div>
        </div>
    )
}