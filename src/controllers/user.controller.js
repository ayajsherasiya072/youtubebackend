import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadonCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"error occur while generating access and refrshtoken")
    }
}

const registerUser=asyncHandler(async (req,res)=>{

   
    const {email,fullname,username,password}=req.body

    if([fullname,email,username,password].some((field)=>field?.trim()===""))
    {
        throw new ApiError(400,"All field are required")
    }

    const existUser= await User.findOne({
        $or:[{email},{username}]
    })
    if(existUser)
    {
        throw new ApiError(409,"User already exist")
    }

    const avatarLocalPath=req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;

    const coverImageLocalPath=req.files?.coverImage?.[0]?.path;
  

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    const avatar=await uploadonCloudinary(avatarLocalPath)
    const coverImage=coverImageLocalPath ? await uploadonCloudinary(coverImageLocalPath):null;

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }

    const user=await User.create({
        email,
        fullname,
        username:username.toLowerCase(),
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        password,
    })

    const creadetUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!creadetUser)
    {
        throw new ApiError(500,"something went wrong while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200,creadetUser,"user register successfully")
    )

})

const loginUser=asyncHandler(async(req,res)=>{

    const {email,username,password}=req.body

    if(!email && !username)
    {
        throw new ApiError(400,"Email and username are required")
    }

    if(!password)
    {
        throw new ApiError(400,"Password is required")
    }

    const user=await User.findOne({
        $or:[{email},{username}]
    })

    if(!user)
    {
        throw new ApiError(404,"user does not exist")
    }

    const validPassword=user.isPasswordCorrect(password)

    if(!validPassword)
    {
        throw new ApiError(402,"incorrect password")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedinUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const option={
        httpOnly:true,
        secure:true
    }

    return res
        .status(200)
        .cookie("accessToken",accessToken,option)
        .cookie("refreshToken",refreshToken,option)
        .json(
            new ApiResponse(
                200,
                {
                    user:loggedinUser,accessToken,refreshToken
                },
                "user loggedin succesfully"
            )
        )



})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:""
            }
        },
        {
            new:true
        }
    )
    const option={
        httpOnly:true,
        secure:true
    }

    return  res
        .status(200)
        .clearCookie("accessToken",option)
        .clearCookie("refreshToken",option)
        .json(new ApiResponse(200,{},"user logout successfully"))

})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken)
    {
        throw new ApiError(401,"unauthorized request")
    }

    try {
        const decodedToken=jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user=await User.findById(decodedToken?._id)
    
        if(!user)
        {
            throw new ApiError(401,"invalid refresh token")
        }
        if(incomingRefreshToken !==user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const option={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,option)
        .cookie("refreshToken",newRefreshToken,option)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "access token refreshed"
            )
        )
    
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh token")
    }
})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    
    const {oldPassword,newPassword}=req.body

    const user=await User.findById(req.user?._id)

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect)
    {
        throw new ApiError(400,"invalid old password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password changed successfully")
    )
})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
        .status(200)
        .json(
            new ApiResponse(200,req.user,"current used fetched successfully")
        )  
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    
    const {fullname,email}=req.body

    if(!fullname || !email)
    {
        throw new ApiError(400,"All feild required")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname:fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"Account details updated sucessfully")
        )
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path


    if(!avatarLocalPath)
    {
        throw new ApiError(400,"Avatar file missing")
    }
    
    
    const avatar=await uploadonCloudinary(avatarLocalPath)
    
    if(!avatar.url)
    {
        throw new ApiError(400,"error while uploading avatar on cloudinary")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"Avatar updated successfully")
        );

    
})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath)
    {
        throw new ApiError(400,"cover image file missing")
    }
    
    
    const coverImage=await uploadonCloudinary(coverImageLocalPath)
    
    if(!coverImage.url)
    {
        throw new ApiError(400,"error while uploading cover image on cloudinary")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"cover image updated successfully")
        )


})

const getUserChannelProfile=asyncHandler(async(req,res)=>{

    const {username}=req.params

    if(!username?.trim())
    {
        throw new ApiError(400,"username is missing")
    }

    const channel=await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelSubscribedToCount:{
                    $size:  "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1,

            }
        }
    ])

    if(!channel?.length)
    {
        throw new ApiError(404,"chnnel does not exists")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200,channel[0],"channel fetch successfully")
        )
})

const getWatchHistory=asyncHandler(async(req,res)=>{

    const user=await User.aggregate([
        {
            $match:{
                _id: new mongoose.Schema.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1,

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200,user[0].watchHistory,"watch history fetch successfully")
        )
})




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}