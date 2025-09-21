/****************************************************************************************
 * @filename      : PartsOrderMyPartListWorkerController
 * @projectname   :
 * @author        : k@windmillsoft
 * @date          : 2023.10.05
 * Test Class     : PartsOrderMyPartListWorkerController_ts.cls
 * @group         :
 * @group-content :
 * @description   : 부품주문 Component의 Resource-Server
 * @tester        :
 * @reference     :
 * @copyright     : 
 * @modification Log
 * ======================================================================================
 *  ver     date        author      description
 * ======================================================================================
    0.1     2023.10.05  K(xanitus)  create       
    0.2     2023.10.24  K(xanitus)  MyPartsList__c 를 Standart WishList로 변환한다.
    0.3     2023.11.10  K(xanitus)  WishlistItems 오브젝트에 Quantity를  추가함
    0.4     2023.11.15  K(xanitus)  장바구니 및 찜 목록 추가시 
    0.5     2023.11.22  K(xanitus)  단가 추가
    0.6     2023.11.23  K(xanitus)  getWishlistItems 제거
                                    getMyPartList 동적 쿼리로 변경
    0.7     2025.09.19  Evander     초기 찜 목록 이름 라벨링
 ****************************************************************************************/
public without sharing class LSTA_PartsOrderMyPartListController {
    @AuraEnabled
    public static PartsOrderResponseWrapper searchParts(Map<String, Object> mapData) {
        mapData.put('addPartByPopup','yes');
        return PartsOrderWorkerController.searchParts(mapData);
    }
    /*
    테스트 코드 : 005Hy00000DMC50 / 0056D000006tG5r
    Map<String, Object> testMap = new Map<String, Object>{'userId' => '005Hy00000DMC50'};
    PartsOrderResponseWrapper clsPartsOrderResponseWrapper = PartsOrderMyPartListWorkerController.getMyPartList(testMap);
    */
    @AuraEnabled
    public static PartsOrderResponseWrapper getMyPartList(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String userId = (mapData != null && mapData.get('userId') != null) ? (String) mapData.get('userId') : UserInfo.getUserId() ;

            // 0개인 경우 초기 찜 목록 2개 추가('자주하는 주문', '필터류')
            Integer cnt = [SELECT COUNT() FROM Wishlist WHERE IsDeleted = false AND OwnerId = :userId];
            if (cnt == 0) {
                String accountId = PartsOrderCommonController.getAccountIdByUserInfo(userId);
                String webStoreId = PartsOrderCommonController.getWebStoreIds();

                List<Wishlist> newWishlists = new List<Wishlist>();
                List<String> initNames = new List<String>{
                    System.Label.Frequent_Orders,
                    System.Label.Filters
                };
                for (String initMyListName : initNames) {
                    Wishlist newWishlist = new Wishlist(
                        Name = initMyListName,
                        WebStoreId = webStoreId,
                        AccountId = accountId
                    );
                    newWishlists.add(newWishlist);
                }
                insert newWishlists;
            }

            String query = '';
            query += 'SELECT    Id, OwnerId, Name, CurrencyIsoCode, WebStoreId, AccountId, WishlistProductCount,CreatedDate,   ';
            query += '          Description__c, CreatedById, LastModifiedDate, ';
            query += '          (SELECT Id, Name, Product2Id,Product2.Name, Product2.Part__r.Partnum__c, Product2.Part__r.OldPartnum__c, Product2.fm_Model_Names__c,isCompSet__c, Remark__c, ';
            query += '                  Product2.Part__r.NameEng__c, Product2.Part__r.NameKor__c, Quantity__c,Product2.REF__c, Product2.PJUNIT__c, Product2.Part__r.Bigo__c, Product2.Part__r.isSalesPart__c,';
            query += '                  CreatedDate,LastOrderedDate__c, LastQuantity__c';
            query += '            FROM  WishlistItems #CONDITION01#) ';
            query += '  FROM    Wishlist  ';
            query += ' WHERE    IsDeleted = false ';
            query += '   AND    OwnerId  = \'' + userId + '\' ';
            if(mapData != null && PartsOrderCommonController.isEmptyStringInObject(mapData.get('checkedId')) == false) {
                List<String> listCheckedId = ((String) mapData.get('checkedId')).split(',');
                query = query.replace('#CONDITION01#','WHERE Id IN ' + PartsOrderCommonController.getListToStringIn(listCheckedId)); 
            } else {
                query = query.replace('#CONDITION01#','');
            }
            List<Wishlist> listWishlist = Database.query(query);
            List<String> listProductId = new List<String>();
            for(Wishlist clsWishlist : listWishlist) {
                for(WishlistItem clsWishlistItem : clsWishlist.WishlistItems) {
                    listProductId.add(clsWishlistItem.Product2Id);
                }
            }
            Boolean isDistributor = [SELECT isDistributor__c FROM User WHERE Id =:UserInfo.getUserId() LIMIT 1].isDistributor__c;
//          TODO : 제품 아이디를 취합하고, 사용자에 맞는 PriceBook 을 통해 단가를 조회한다.
//          TODO : 여기서는 대리점 가격만을 조회한다. 후에 설정에 따라 조회되도록 해야 한다.   
            String priceBookName = 'FC Part Price Book';
            if(isDistributor) priceBookName = 'FF Part Price Book';
            List<PricebookEntry> listPricebookEntry = [
                SELECT  id,UnitPrice,UnitPrice_FA__c, UnitPrice_FB__c, UnitPrice_FC__c, UnitPrice_FD__c, UnitPrice_FF__c, UnitPrice_LSTA__c,Product2Id
                  FROM  PricebookEntry 
                 WHERE  Pricebook2.Name = :priceBookName
                   AND  Product2Id IN :listProductId
                   AND  IsActive = true
                   AND  CurrencyIsoCode = 'KRW'
            ];
            Map<String,PricebookEntry> mapPricebookEntry = new Map<String,PricebookEntry>();
            for(PricebookEntry clsPricebookEntry : listPricebookEntry) {
                mapPricebookEntry.put(clsPricebookEntry.Product2Id,clsPricebookEntry);
            }
            PartsOrderMyPartListVO clsPartsOrderMyPartListVO = new PartsOrderMyPartListVO();
            clsPartsOrderMyPartListVO.listWishlist = listWishlist;
            clsPartsOrderMyPartListVO.mapPricebookEntry = mapPricebookEntry;
            clsPartsOrderResponseWrapper.payload = (Object) clsPartsOrderMyPartListVO;
        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message = Ex.getMessage() + ',' + Ex.getStackTraceString() + ',' + mapData;
        }   
        return clsPartsOrderResponseWrapper;
    }

    @AuraEnabled
    public static PartsOrderResponseWrapper editMyPartList(Map<String, Object> mapData) {
        PartsOrderResponseWrapper responseWrapper = new PartsOrderResponseWrapper();
        try {
            String wishlistId = (String) mapData.get('Id');
            String name = ((String) mapData.get('name')) != null ? ((String) mapData.get('name')).trim() : null;
            String description = (String) mapData.get('description');
            description = description != null ? description.trim() : null;

            if (String.isBlank(wishlistId)) {
                responseWrapper.result = PartsOrderResponseWrapper.NOK;
                responseWrapper.message = 'Wishlist Id is required.';
                return responseWrapper;
            }
            if (String.isBlank(name)) {
                responseWrapper.result = PartsOrderResponseWrapper.NOK;
                responseWrapper.message = 'Name is required.';
                return responseWrapper;
            }

            Wishlist wishlistRecord = [
                SELECT Id, Name, Description__c, AccountId
                FROM Wishlist
                WHERE Id = :wishlistId
                LIMIT 1
            ];

            if (isDuplicatedWishlistName(name, wishlistRecord.AccountId, wishlistId)) {
                responseWrapper.result = PartsOrderResponseWrapper.NOK;
                responseWrapper.message = 'duplicated';
                return responseWrapper;
            }

            Boolean shouldUpdateName = (name != wishlistRecord.Name);
            Boolean shouldUpdateDescription = false;

            if (mapData.containsKey('description')) {
                if (String.isNotBlank(description)) {
                    shouldUpdateDescription = (description != wishlistRecord.Description__c);
                } else {
                    shouldUpdateDescription = String.isNotBlank(wishlistRecord.Description__c);
                    description = '';
                }
            }

            if (shouldUpdateName || shouldUpdateDescription) {
                if (shouldUpdateName) {
                    wishlistRecord.Name = name;
                }
                if (shouldUpdateDescription) {
                    wishlistRecord.Description__c = description;
                }
                update wishlistRecord;
            }

            responseWrapper.result = PartsOrderResponseWrapper.OK;
            responseWrapper.payload = wishlistRecord;
            return responseWrapper;

        } catch (Exception e) {
            responseWrapper.result = PartsOrderResponseWrapper.NOK;
            responseWrapper.message = e.getStackTraceString();
            return responseWrapper;
        }
    }

    @AuraEnabled
    public static PartsOrderResponseWrapper addMyPartList(Map<String, Object> mapData) {
        PartsOrderResponseWrapper responseWrapper = new PartsOrderResponseWrapper();
        try {
            String name = ((String) mapData.get('name')) != null ? ((String) mapData.get('name')).trim() : null;
            String description = (String) mapData.get('description');

            if (String.isBlank(name)) {
                responseWrapper.result = PartsOrderResponseWrapper.NOK;
                responseWrapper.message = 'Name is required.';
                return responseWrapper;
            }

            Id webStoreId = PartsOrderCommonController.getWebStoreIds();
            Id accountId = PartsOrderCommonController.getAccountIdByUserInfo(UserInfo.getUserId());

            if (isDuplicatedWishlistName(name, accountId, null)) {
                responseWrapper.result = PartsOrderResponseWrapper.NOK;
                responseWrapper.message = 'duplicated';
                return responseWrapper;
            }

            Wishlist wishlistRecord = new Wishlist();
            wishlistRecord.Name = name;
            wishlistRecord.Description__c = description;
            wishlistRecord.WebStoreId = webStoreId;
            wishlistRecord.AccountId = accountId;
            wishlistRecord.CurrencyIsoCode = null;

            insert wishlistRecord;
            String recordId = wishlistRecord.Id;

            wishlistRecord = [
                SELECT
                    Id,
                    OwnerId,
                    Name,
                    CurrencyIsoCode,
                    WebStoreId,
                    AccountId,
                    WishlistProductCount,
                    CreatedDate,
                    Description__c,
                    CreatedById,
                    LastModifiedDate,
                    (
                        SELECT
                            Id,
                            Name,
                            Product2Id,
                            Product2.Name,
                            Product2.Part__r.Partnum__c,
                            Product2.Part__r.OldPartnum__c,
                            Product2.fm_Model_Names__c,
                            isCompSet__c,
                            Remark__c,
                            Product2.Part__r.NameEng__c,
                            Product2.Part__r.NameKor__c,
                            Quantity__c,
                            Product2.REF__c,
                            Product2.PJUNIT__c,
                            Product2.Part__r.Bigo__c,
                            Product2.Part__r.isSalesPart__c,
                            CreatedDate,
                            LastOrderedDate__c,
                            LastQuantity__c
                        FROM WishlistItems
                    )
                FROM Wishlist
                WHERE Id = :recordId
            ];

            responseWrapper.result = PartsOrderResponseWrapper.OK;
            responseWrapper.payload = wishlistRecord;
            return responseWrapper;

        } catch (Exception e) {
            responseWrapper.result = PartsOrderResponseWrapper.NOK;
            responseWrapper.message = e.getMessage();
            return responseWrapper;
        }
    }

    private static Boolean isDuplicatedWishlistName(String name, Id accountId, Id excludeId) {
        if (String.isBlank(name) || accountId == null) {
            return false;
        }

        String queryString = 
            'SELECT COUNT() ' +
            'FROM Wishlist ' +
            'WHERE AccountId = :accountId ' +
            'AND Name = :name';

        if (excludeId != null) {
            queryString += ' AND Id != :excludeId';
        }

        Integer existingCount = Database.countQuery(queryString);
        return existingCount > 0;
    }

    /*
    테스트 정보 :     
    Map<String, Object> mapElement = new Map<String, Object>{'Quantity__c' => '11', 'Id' => '3osHy0000008OSYIA2'};
    List<Object> listMyPartListItems = new List<Object>();
    listMyPartListItems.add(mapElement);
    Map<String, Object> mapData = new Map<String, Object>{'myParstList' => '3orHy0000008ONVIA2','myPartListItems' => listMyPartListItems};
    PartsOrderResponseWrapper clsPartsOrderResponseWrapper = PartsOrderMyPartListWorkerController.editMyPartListItems(mapData);
    */
    @AuraEnabled
    public static PartsOrderResponseWrapper editMyPartListItems(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String myParstListId = (String) mapData.get('myParstList');
            List<Object> listMyPartListItems = (List<Object>) mapData.get('myPartListItems');
            List<WishlistItem> listWishlistItem = new List<WishlistItem>();
            for(Object objMyPartListItem : listMyPartListItems) {
                WishlistItem clsWishlistItem = (WishlistItem) System.JSON.deserialize(Json.serialize(objMyPartListItem), WishlistItem.class);                
                listWishlistItem.add(clsWishlistItem);
            }
            Update listWishlistItem;
            clsPartsOrderResponseWrapper.payload = listWishlistItem;
        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message += Ex.getStackTraceString() + ',' + Ex.getMessage();
        }   
        return clsPartsOrderResponseWrapper;
    }
    @AuraEnabled
    public static PartsOrderResponseWrapper addMyPartListItems(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String myPartsListId = (String) mapData.get('myParstList');
            List<Object> partsList = (List<Object>) mapData.get('partsList');
            List<WishlistItem> listMyPartsListItem = new List<WishlistItem>();
            List<String> listPartNumber = new List<String>();
            Map<String,Decimal> mapQuantity = new Map<String,Decimal>();
            for(Object clsPart : partsList) {
                Part__c clsPartCast = (Part__c) System.JSON.deserialize(Json.serialize(clsPart), Part__c.class);
                listPartNumber.add(clsPartCast.Partnum__c);
                mapQuantity.put(clsPartCast.Partnum__c,clsPartCast.Quantity__c != null ?  clsPartCast.Quantity__c : 1);
            }                        
            Map<String,Product2> mapProductWithPartNumnber = PartsOrderProductWorkerController.getProductIdByPartNumbers(listPartNumber);   
            Map<String,WishlistItem> mapWishlistItemWithProduct = PartsOrderMyPartListWorkerController.getWhishListItems(myPartsListId);
            for(String partNumber : listPartNumber) {
                Product2 clsProduduct = mapProductWithPartNumnber.get(partNumber);
                WishlistItem clsWishlistItem = mapWishlistItemWithProduct.get(clsProduduct.Id);
                if(clsWishlistItem == null) {
                    clsWishlistItem = new WishlistItem();
                    clsWishlistItem.Name = clsProduduct.Part__r.NameKor__c;
                    clsWishlistItem.Product2Id = clsProduduct.Id;
                    clsWishlistItem.WishlistId = myPartsListId;
                    clsWishlistItem.Quantity__c = mapQuantity.get(partNumber);
                } else {
                    clsWishlistItem.Quantity__c += mapQuantity.get(partNumber);
                }
                listMyPartsListItem.add(clsWishlistItem);
            }
            Upsert listMyPartsListItem;
            clsPartsOrderResponseWrapper.payload = listMyPartsListItem;

        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message += Ex.getStackTraceString() + ',' + Ex.getMessage();
        }   
        return clsPartsOrderResponseWrapper;
    }
    @AuraEnabled
    public static PartsOrderResponseWrapper removeMyPartListItems(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            List<Object> myPartsListItemId = (List<Object> ) mapData.get('Id');
            List<WishlistItem> listMyPartsListItem = new List<WishlistItem>();
            for(Object Id : myPartsListItemId) {
                WishlistItem clsMyPartsListItem = new WishlistItem(Id = (String) Id);
                listMyPartsListItem.add(clsMyPartsListItem);
            }
            Delete listMyPartsListItem;
            clsPartsOrderResponseWrapper.payload = listMyPartsListItem;
        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message = Ex.getStackTraceString();
        }   
        return clsPartsOrderResponseWrapper;
    }
    @AuraEnabled
    public static PartsOrderResponseWrapper removeAllyPartListItems(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String myPartsListId = (String) mapData.get('Id');
            List<WishlistItem> listMyPartsListItem = [SELECT Id from WishlistItem WHERE WishlistId = :myPartsListId];
            Delete listMyPartsListItem;
            clsPartsOrderResponseWrapper.payload = listMyPartsListItem;
        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message = Ex.getStackTraceString();
        }   
        return clsPartsOrderResponseWrapper;
    }
    @AuraEnabled
    public static PartsOrderResponseWrapper removePartList(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String myPartsListId = (String) mapData.get('Id');
            Wishlist clsMyPartsList = [SELECT Id from Wishlist WHERE Id = :myPartsListId][0];
            Delete clsMyPartsList;
            clsPartsOrderResponseWrapper.payload = clsMyPartsList;
        } catch(Exception Ex) {
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message = Ex.getStackTraceString();
        }   
        return clsPartsOrderResponseWrapper;
    }
    /*
    테스트 정보 : 
    Map<String, Object> mapData = new Map<String, Object>{'contentDocumentId' => '069Hy000002dj6eIAA','myPartsListId' => '3orHy0000008ONVIA2'};
    PartsOrderResponseWrapper clsPartsOrderResponseWrapper = PartsOrderMyPartListWorkerController.parseMyPartsItemCSVFile(mapData);
    */
    @AuraEnabled
    public static PartsOrderResponseWrapper parseMyPartsItemCSVFile(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            String myPartsListId = (String) mapData.get('myPartsListId');
            String contentDocumentId = (String) mapData.get('contentDocumentId');
            ContentVersion clsContentVersion = [
                SELECT  VersionData,PathOnClient,FileType
                  FROM  ContentVersion
                 WHERE  ContentDocumentId = :contentDocumentId
                 ORDER  BY VersionNumber DESC LIMIT 1
            ];
            String buffer = clsContentVersion.VersionData.toString(); 
            List<WishlistItem> listMyPartsListItem = new List<WishlistItem>();
            List<String> listLine = buffer.split('\n');
            List<String> listPartNumber = new List<String>();

            // 자신의 찜 목록을 가져오기(Map<Name, Id>)
            Map<String, Wishlist> wishlistMap = getMyWishlistMap();

            // 새로운 찜 목록 확인 및 추가
            String userId = UserInfo.getUserId();
            String accountId = PartsOrderCommonController.getAccountIdByUserInfo(userId);
            String webStoreId = PartsOrderCommonController.getWebStoreIds();
            List<Wishlist> newWishlists = new List<Wishlist>();
            Boolean isFirst = false;
            for(String line : listLine) {
                if(isFirst == false) {
                    isFirst = true;
                    continue;
                }
                List<String> listElement = line.split(',');
                WishlistItem clsMyPartsListItem = new WishlistItem();
                if (!wishlistMap.containsKey(listElement.get(0).trim()) && !String.isBlank(listElement.get(0).trim())) { // 기존 찜 목록이 없으면
                    Wishlist newWishlist = new Wishlist();
                    newWishlist.Name = listElement.get(0).trim();
                    newWishlist.WebStoreId = webStoreId;
                    newWishlist.AccountId = accountId;
                    newWishlists.add(newWishlist);
                    wishlistMap.put(newWishlist.Name, null);
                }
            }
            insert newWishlists;

            // 다시 자신의 찜 목록을 가져오기(Map<Name, Id>)
            wishlistMap = getMyWishlistMap();

            isFirst = false;
            for(String line : listLine) {
                if(isFirst == false) {
                    isFirst = true;
                    continue;
                }
                List<String> listElement = line.split(',');
                WishlistItem clsMyPartsListItem = new WishlistItem();
                if (wishlistMap.containsKey(listElement.get(0).trim())) { // 찜 목록이 있으면
                    clsMyPartsListItem.WishlistId = wishlistMap.get(listElement.get(0).trim()).Id;
                } else if (String.isBlank(listElement.get(0).trim())) { // 입력을 안했을 때
                    clsMyPartsListItem.WishlistId = myPartsListId;
                } else {
                    continue;
                }
                // 자재번호나 수량 입력이 없을 때 넘기기
                if(String.isBlank(listElement.get(1).trim()) || String.isBlank(listElement.get(2).trim())) continue;
                // 중복된 자재번호가 있을 때 넘기기
                if(listPartNumber.contains(listElement.get(1).trim())) continue;

                clsMyPartsListItem.Name = listElement.get(1).trim();
                clsMyPartsListItem.Quantity__c = Decimal.valueOf(listElement.get(2).trim());
                clsMyPartsListItem.Remark__c = listElement.get(3).trim();

                listPartNumber.add(listElement.get(1).trim());
                listMyPartsListItem.add(clsMyPartsListItem);
            } 
            Map<String,Product2> mapProductWithPartNumnber = PartsOrderProductWorkerController.getProductIdByPartNumbers(listPartNumber);
            Map<String, Map<String,WishlistItem>> mapwishlistItemWithProductByWishlist = new Map<String, Map<String,WishlistItem>>(); // wishlistId/ProductId/WishlistItem
            Integer offset = 0;
            List<WishlistItem> listMyPartsListItemToSave = new List<WishlistItem>();
            for(WishlistItem clsMyPartsListItem : listMyPartsListItem) { 
                Product2 clsProduduct = mapProductWithPartNumnber.get(listPartNumber.get(offset++));
                if (!mapwishlistItemWithProductByWishlist.containsKey(clsMyPartsListItem.WishlistId)) {
                    Map<String,WishlistItem> mapWishlistItemWithProduct = PartsOrderMyPartListWorkerController.getWhishListItems(clsMyPartsListItem.WishlistId);
                    mapwishlistItemWithProductByWishlist.put(clsMyPartsListItem.WishlistId, mapWishlistItemWithProduct);
                }
                WishlistItem clsWishlistItem = null;
                if(mapwishlistItemWithProductByWishlist.containsKey(clsMyPartsListItem.WishlistId) && clsProduduct != null){
                    clsWishlistItem = mapwishlistItemWithProductByWishlist.get(clsMyPartsListItem.WishlistId).get(clsProduduct.Id);
                }
                WishlistItem clsMyPartsListItemToSave = clsMyPartsListItem;
//              DESC : 제품이 있는 경우만
                if(clsProduduct != null) {
                    if(clsWishlistItem == null) {
//                      DESC : 기존 자료가 없는 경우    
                        clsMyPartsListItemToSave.Product2Id = clsProduduct.Id;
                        clsMyPartsListItemToSave.Name = clsProduduct.Part__r.NameKor__c;
                    } else {
//                      DESC : 기존 제품이 있는 경우, 수량을 변경한다                        
                        clsMyPartsListItemToSave = clsWishlistItem;
                        clsMyPartsListItemToSave.Quantity__c += clsMyPartsListItem.Quantity__c;
                    }
                    listMyPartsListItemToSave.add(clsMyPartsListItemToSave);
                }                
            }
            System.debug('## listMyPartsListItemToSave : ' + listMyPartsListItemToSave);
            Upsert listMyPartsListItemToSave;
            clsPartsOrderResponseWrapper.payload = listMyPartsListItemToSave;
        } catch(Exception Ex) {
            System.debug('## partFileMyParts ## Ex : ' + Ex);
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message += ' > ' + Ex.getStackTraceString() + Ex.getMessage();
        }   
        return clsPartsOrderResponseWrapper;
    }
    private static Map<String, Wishlist> getMyWishlistMap() {
        String userId = UserInfo.getUserId();
        String webStoreId = PartsOrderCommonController.getWebStoreIds();
        List<Wishlist> wishlists = [
            SELECT Id, Name
              FROM Wishlist 
             WHERE OwnerId = :userId
               AND WebStoreId = :webStoreId
        ];
        Map<String, Wishlist> wishlistMap = new Map<String, Wishlist>();
        for (Wishlist wishlist : wishlists) {
            wishlistMap.put(wishlist.Name, wishlist);
        }
        return wishlistMap;
    }
    public static Map<String,WishlistItem> getWhishListItems(String wishlistId) {
        Map<String,WishlistItem> mapToReturn = new Map<String,WishlistItem>();
        List<WishlistItem> listWishlistItem = [
            SELECT  Id,  Name, CurrencyIsoCode, WishlistId, Product2Id, Quantity__c
              FROM  WishlistItem 
             WHERE  WishlistId = :wishlistId
        ];
        for(WishlistItem clsWishlistItem : listWishlistItem) {
            mapToReturn.put(clsWishlistItem.Product2Id,clsWishlistItem);
        }
        return mapToReturn;
    }
    /*
    테스트 :
    List<Map<String, String>> listPart = new List<Map<String, String>>();
    Map<String, String> mapPart = new Map<String, String>{
        'Id' => 'a2UHy000002F7cpMAC', 
        'Name' => 'submit or reset a form', 
        'Description__c' => 'The submit and reset types create buttons for subm…eir initial values, see lightning:recordEditForm.'
    };
    Map<String, String> mapCart = new Map<String, String>{
        'Id' => '0', 
        'Name' => 'Cart', 
        'Description__c' => 'Cart'
    };
    listPart.add(mapPart);
    listPart.add(mapCart);
    List<Map<String, String>> listPartItem = new List<Map<String, String>>();
    Map<String, String> mapPartItem = new Map<String, String>{
        'Id' => 'a2VHy000000ZKrGMAW',
        'MyPartsList__c' => 'a2UHy000002F7cpMAC',
        'Name' => 'a2VHy000000ZKm7',
        'NameEnglish__c' => 'SWITCH ASSY-KEY-TRG750',
        'NameKorean__c' => '키 스위치 조립체',
        'OldPartNumber__c' => 'A1750254',
        'PartNumber__c' => '20020344',
        'Part__c' => 'a2J6D00000AEWQVUA5'
    };
    listPartItem.add(mapPartItem);
    Map<String, Object> mapData = new Map<String, Object>{
        'partList' => listPart,
        'partsListItem' => listPartItem,
        'type' => 'move'
    };
    PartsOrderMyPartListWorkerController.clonePartList(mapData);
    */
    @AuraEnabled
    public static PartsOrderResponseWrapper clonePartList(Map<String, Object> mapData) {
        PartsOrderResponseWrapper clsPartsOrderResponseWrapper = new PartsOrderResponseWrapper();
        try {
            List<Object> listPartsList = (List<Object>) mapData.get('partList');
            List<Object> listPartsListItem = (List<Object>) mapData.get('partsListItem');
            String type = (String) mapData.get('type');
            List<WishlistItem > listMyPartsListItem = new List<WishlistItem >();
            List<WishlistItem > listMyPartsListItemtoSave = new List<WishlistItem >();
            List<Wishlist> listMyPartsList = new List<Wishlist >();
            List<String> listPartNumber = new List<String>();
//          DESC : 선택된 아이템 항목            
            for(Object partsItem : listPartsListItem) {
                WishlistItem clsMyPartsListItem = (WishlistItem) System.JSON.deserialize(Json.serialize(partsItem), WishlistItem.class);
                listMyPartsListItem.add(clsMyPartsListItem);
                listPartNumber.add(clsMyPartsListItem.Product2.Part__r.Partnum__c);
            }
            Map<String,Product2> mapProductWithPartNumnber = PartsOrderProductWorkerController.getProductIdByPartNumbers(listPartNumber);
            for(Object partsList : listPartsList) {
                Wishlist clsMyPartsList = (Wishlist) System.JSON.deserialize(Json.serialize(partsList), Wishlist.class);       
                System.debug('## clsMyPartsList : ' + clsMyPartsList);

                if('0'.equals(String.valueOf(clsMyPartsList.Id)) == true ) {
//                  DESC : partList 의 Id 가 0 이라면 대상 리스트는 장바구니이다.
                    List<Object> listPartCart = new List<Object>();
                    Map<Object,Object> mapItem = new Map<Object,Object>();
                    for(WishlistItem  clsMyPartsListItem : listMyPartsListItem) {
                        mapItem = new Map<Object,Object>{'partNumber' => clsMyPartsListItem.Product2.Part__r.Partnum__c , 'quantity' => String.valueOf(clsMyPartsListItem.Quantity__c)};
                        listPartCart.add(mapItem);
                    }
                    System.debug('## add Cart in wishlist : ' + listPartCart);
                    Map<String, Object> mapDataToCart = new Map<String, Object>{'item' => listPartCart};
                    PartsOrderResponseWrapper clsResultToCart = PartsOrderCartWorkerController.addToWebCart(mapDataToCart);
                    if (!clsResultToCart.isOK()) {
                        clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
                        clsPartsOrderResponseWrapper.message = clsResultToCart.message;
                        return clsPartsOrderResponseWrapper;
                    }
                    continue;
                } else {
//                  DESC : 선택된 아이템을 목록으로 복사한다. 
//                  DESC : 개수가 더해져야 하는데..  
                    Map<String,WishlistItem> mapWishlistItemWithProduct = PartsOrderMyPartListWorkerController.getWhishListItems(clsMyPartsList.Id);
                    for(WishlistItem clsMyPartsListItem : listMyPartsListItem) {
                        WishlistItem clsWishlistItem = mapWishlistItemWithProduct.get(clsMyPartsListItem.Product2Id);
                        if(clsWishlistItem == null) {
                            WishlistItem clsMyPartsListItemToSave = new WishlistItem (
                                Name = clsMyPartsListItem.Name,
                                WishlistId  = clsMyPartsList.Id,
                                Product2Id = mapProductWithPartNumnber.get(clsMyPartsListItem.Product2.Part__r.Partnum__c).Id,
                                Quantity__c = clsMyPartsListItem.Quantity__c
                            );                    
                            listMyPartsListItemtoSave.add(clsMyPartsListItemToSave);
                        } else {
                            clsWishlistItem.Quantity__c += clsMyPartsListItem.Quantity__c;
                            listMyPartsListItemtoSave.add(clsWishlistItem);
                        }
                    }
                }
            }
//          DESC : 저장할 부품 목록이 있다면            
            if(listMyPartsListItemtoSave.size() > 0) {
                Upsert listMyPartsListItemtoSave;
            }
//          DESC : 작업 유형이 이동이라면, 선택된 아이템 항목을 삭제한다.   
            if(type.equals('move') == true) {
                Delete listMyPartsListItem;
            }
            clsPartsOrderResponseWrapper.payload = listMyPartsListItemtoSave;

        } catch(Exception Ex) {            
            clsPartsOrderResponseWrapper.result = PartsOrderResponseWrapper.NOK;
            clsPartsOrderResponseWrapper.message = Ex + ',' + Ex.getStackTraceString();
            System.debug('## clonePartList ## Ex : ' + clsPartsOrderResponseWrapper.message);
        }   
        return clsPartsOrderResponseWrapper;
    }

    @AuraEnabled
    public static PartsOrderResponseWrapper addToCart(Map<String, Object> mapData) {
        return PartsOrderCartWorkerController.addToWebCart(mapData);
    }

    @AuraEnabled
    public static PartsOrderResponseWrapper getPartInAddCart(Map<String, Object> mapData) {
        return PartsOrderCartWorkerController.getPartInAddCart(mapData);
    }

    @AuraEnabled
    public static Boolean getIsDistributor(){
        Boolean isDistributor = false;
        User currentUser = [SELECT Id, AccountId FROM User WHERE Id =: UserInfo.getUserId() LIMIT 1];
        if(currentUser.AccountId != null){
            Account acc = [SELECT Id, IsDistributor__c FROM Account WHERE Id = :currentUser.AccountId LIMIT 1];
            isDistributor = acc.IsDistributor__c;
        }
        return isDistributor;
    }

    @AuraEnabled
    public static Boolean getIsLSTAUser(){
        User user = [SELECT Id, Profile.Name FROM User WHERE Id =:UserInfo.getUserId() LIMIT 1];
        return user.Profile.Name == 'LSTA Dealer';
    }

}