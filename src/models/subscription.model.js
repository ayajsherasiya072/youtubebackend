import mongoose from 'mongoose';

const subscriptionSchema=new mongoose.Schema({
    subscriber:{
        type:mongoose.Schema.Types.ObjectId,// one who is buy subscription
        ref:"User"
    },
    channel:{
        type:mongoose.Schema.Types.ObjectId, // this is chanel owner
        ref:"User"
    }
},{timestamps:true})

export const Subscription=mongoose.model("Subscription",subscriptionSchema)


