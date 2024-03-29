import styles from './NewRegister.module.css'

function newRegister(){
    let name = document.getElementById("registerName")
}

export default function NewRegister(){

    return(
        <div className={styles.newRegister}>
            <h1>NEW REGISTER</h1>
            <form className={styles.inputsContainer}>
                <label htmlFor="registerName">Name</label>
                <input id="registerName" type="text" />

                <label htmlFor="description">Description</label>
                <textarea cols="30" rows="10" id="description" className={styles.inclusionDate}></textarea>

                <label htmlFor="inclusionDate">Inclusion Date</label>
                <input id="inclusionDate" type="date" />

                <label htmlFor="expireDate">Expire Date</label>
                <input id="expireDate" type="date" />

                <label htmlFor="value">Value</label>
                <input id='value' type="number" />

                <label htmlFor="installments">Installments</label>
                <input id='installments' type="number" />

                <label htmlFor="paymentMethod">Payment Method</label>
                <select name="paymentMethod" id="paymentMethod">
                    <option value="money">Money</option>
                    <option value="pix">Pix</option>
                    <option value="creditCard">Credit Card</option>
                    <option value="debitCard">Debit Card</option>
                </select>
                
                <button className={styles.registerButton}>Register</button>
            </form>
        </div>
    )
}