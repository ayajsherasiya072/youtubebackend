import mongoose from "mongoose";
import {DB_NAME} from '../constants.js';


const connectDB=async()=>{
    try {
        await mongoose.connect(`${process.env.URL}/${DB_NAME}`)
        console.log(`db connectted`);
        
    }
    catch(error)
    {
        console.log("mongodb error",error);
        process.exit(1)
    }
}

export default connectDB